const fs = require('node:fs');
const path = require('node:path');

function renderVisionOcrSwift() {
  return `import Foundation
import UIKit
import Vision
import ImageIO

@objc(InciFactVisionOcr)
final class InciFactVisionOcr: NSObject {
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }

  private func cgOrientation(from uiOrientation: UIImage.Orientation) -> CGImagePropertyOrientation {
    switch uiOrientation {
    case .up: return .up
    case .down: return .down
    case .left: return .left
    case .right: return .right
    case .upMirrored: return .upMirrored
    case .downMirrored: return .downMirrored
    case .leftMirrored: return .leftMirrored
    case .rightMirrored: return .rightMirrored
    @unknown default: return .up
    }
  }

  private func sortObservationsByRowClusters(
    _ observations: [VNRecognizedTextObservation],
    isRtl: Bool
  ) -> [VNRecognizedTextObservation] {
    // Pass 1: strict weak ordering purely on vertical top coordinate (mathematically transitive; never traps Array.sort)
    let byTop = observations.sorted { lhs, rhs in
      let lhsTop = 1.0 - lhs.boundingBox.maxY
      let rhsTop = 1.0 - rhs.boundingBox.maxY
      if lhsTop != rhsTop {
        return lhsTop < rhsTop
      }
      return lhs.boundingBox.minX < rhs.boundingBox.minX
    }

    // Pass 2: deterministic row clustering within 0.015 normalized vertical band
    var rows: [[VNRecognizedTextObservation]] = []
    var currentRow: [VNRecognizedTextObservation] = []
    var currentAnchorTop: CGFloat = 0

    for obs in byTop {
      let obsTop = 1.0 - obs.boundingBox.maxY
      if currentRow.isEmpty {
        currentRow = [obs]
        currentAnchorTop = obsTop
      } else if abs(obsTop - currentAnchorTop) <= 0.015 {
        currentRow.append(obs)
      } else {
        rows.append(currentRow)
        currentRow = [obs]
        currentAnchorTop = obsTop
      }
    }
    if !currentRow.isEmpty {
      rows.append(currentRow)
    }

    // Pass 3: strict weak ordering horizontally within each row cluster
    var ordered: [VNRecognizedTextObservation] = []
    ordered.reserveCapacity(observations.count)
    for var row in rows {
      row.sort { lhs, rhs in
        if isRtl {
          return lhs.boundingBox.maxX > rhs.boundingBox.maxX
        }
        return lhs.boundingBox.minX < rhs.boundingBox.minX
      }
      ordered.append(contentsOf: row)
    }
    return ordered
  }

  private func resolveSupportedRecognitionLanguages(
    for request: VNRecognizeTextRequest,
    normalizedLang: String
  ) -> [String] {
    // Map Urdu hint to Arabic script + English fallback since Apple Vision does not ship a dedicated ur-PK model
    let preferredPrefix: [String]
    if normalizedLang.hasPrefix("ur") {
      preferredPrefix = ["ur-PK", "ar-SA", "en-US"]
    } else if normalizedLang.hasPrefix("ar") {
      preferredPrefix = ["ar-SA", "en-US"]
    } else if normalizedLang.hasPrefix("ru") {
      preferredPrefix = ["ru-RU", "en-US"]
    } else if normalizedLang.hasPrefix("tr") {
      preferredPrefix = ["tr-TR", "en-US"]
    } else if normalizedLang.hasPrefix("de") {
      preferredPrefix = ["de-DE", "en-US"]
    } else if normalizedLang.hasPrefix("fr") {
      preferredPrefix = ["fr-FR", "en-US"]
    } else if normalizedLang.hasPrefix("es") {
      preferredPrefix = ["es-ES", "en-US"]
    } else {
      preferredPrefix = ["en-US"]
    }

    let baseCandidates = [
      "en-US", "tr-TR", "de-DE", "fr-FR", "es-ES", "ar-SA", "ru-RU", "id-ID", "ms-MY", "ur-PK"
    ]
    var candidates: [String] = []
    for code in preferredPrefix + baseCandidates {
      if !candidates.contains(code) {
        candidates.append(code)
      }
    }

    let supported: [String]
    if #available(iOS 15.0, *) {
      supported = (try? request.supportedRecognitionLanguages()) ?? []
    } else {
      supported = (try? VNRecognizeTextRequest.supportedRecognitionLanguages(
        for: .accurate,
        revision: request.revision
      )) ?? []
    }
    if supported.isEmpty {
      return ["en-US"]
    }
    let supportedSet = Set(supported)
    let filtered = candidates.filter { supportedSet.contains($0) }
    return filtered.isEmpty ? ["en-US"] : filtered
  }

  @objc(detectFromUri:resolver:rejecter:)
  func detectFromUri(
    _ uriString: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    performDetection(uriString, langHint: "en", resolver: resolve, rejecter: reject)
  }

  @objc(detectFromUriWithLang:langHint:resolver:rejecter:)
  func detectFromUriWithLang(
    _ uriString: String,
    langHint: String?,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    performDetection(uriString, langHint: langHint ?? "en", resolver: resolve, rejecter: reject)
  }

  private func performDetection(
    _ uriString: String,
    langHint: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let trimmed = uriString.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.isEmpty {
      reject("OCR_INVALID_URI", "Image URI is empty.", nil)
      return
    }
    let normalizedLang = langHint.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    let isRtl = normalizedLang.hasPrefix("ar") || normalizedLang.hasPrefix("ur")

    DispatchQueue.global(qos: .userInitiated).async {
      let url: URL
      if let parsed = URL(string: trimmed), parsed.scheme != nil {
        url = parsed
      } else {
        url = URL(fileURLWithPath: trimmed)
      }

      guard let imageData = try? Data(contentsOf: url),
            let uiImage = UIImage(data: imageData),
            let cgImage = uiImage.cgImage else {
        reject("OCR_IMAGE_LOAD_FAILED", "Could not load image data for on-device OCR.", nil)
        return
      }

      let settleLock = NSLock()
      var settled = false
      let resolveOnce: (Any?) -> Void = { payload in
        settleLock.lock()
        if settled {
          settleLock.unlock()
          return
        }
        settled = true
        settleLock.unlock()
        resolve(payload)
      }
      let rejectOnce: (String, String, Error?) -> Void = { code, message, err in
        settleLock.lock()
        if settled {
          settleLock.unlock()
          return
        }
        settled = true
        settleLock.unlock()
        reject(code, message, err)
      }

      let request = VNRecognizeTextRequest { req, error in
        if let error = error {
          rejectOnce("OCR_RECOGNITION_FAILED", error.localizedDescription, error)
          return
        }

        let observations = (req.results as? [VNRecognizedTextObservation]) ?? []
        let sorted = self.sortObservationsByRowClusters(observations, isRtl: isRtl)

        var blocks: [[String: Any]] = []
        for obs in sorted {
          guard let top = obs.topCandidates(1).first else { continue }
          let text = top.string.trimmingCharacters(in: .whitespacesAndNewlines)
          if text.isEmpty { continue }
          blocks.append([
            "text": text,
            "confidence": Double(top.confidence)
          ])
        }
        resolveOnce(blocks)
      }

      request.recognitionLevel = .accurate
      request.usesLanguageCorrection = true
      if #available(iOS 16.0, *) {
        request.automaticallyDetectsLanguage = true
      } else {
        request.recognitionLanguages = self.resolveSupportedRecognitionLanguages(
          for: request,
          normalizedLang: normalizedLang
        )
      }

      let orientation = self.cgOrientation(from: uiImage.imageOrientation)
      let handler = VNImageRequestHandler(cgImage: cgImage, orientation: orientation, options: [:])
      do {
        try handler.perform([request])
      } catch {
        rejectOnce("OCR_RECOGNITION_FAILED", error.localizedDescription, error)
      }
    }
  }
}
`;
}

function renderVisionOcrObjcBridge() {
  return `#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(InciFactVisionOcr, NSObject)

RCT_EXTERN_METHOD(detectFromUri:(NSString *)uriString
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(detectFromUriWithLang:(NSString *)uriString
                  langHint:(NSString * _Nullable)langHint
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
`;
}

function withIosVisionOcr(config) {
  const { withDangerousMod, withXcodeProject, IOSConfig } = require('@expo/config-plugins');

  let next = withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const projectName = cfg.modRequest.projectName || 'InciFact';
      const iosTargetDir = path.join(cfg.modRequest.platformProjectRoot, projectName);
      fs.mkdirSync(iosTargetDir, { recursive: true });
      fs.writeFileSync(path.join(iosTargetDir, 'InciFactVisionOcr.swift'), renderVisionOcrSwift(), 'utf8');
      fs.writeFileSync(path.join(iosTargetDir, 'InciFactVisionOcr.m'), renderVisionOcrObjcBridge(), 'utf8');
      return cfg;
    }
  ]);

  next = withXcodeProject(next, (cfg) => {
    const projectName = cfg.modRequest.projectName || 'InciFact';
    const proj = cfg.modResults;
    for (const fileName of ['InciFactVisionOcr.swift', 'InciFactVisionOcr.m']) {
      const filePath = `${projectName}/${fileName}`;
      if (typeof proj.hasFile !== 'function' || !proj.hasFile(filePath)) {
        IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
          filepath: filePath,
          groupName: projectName,
          project: proj
        });
      }
    }
    return cfg;
  });

  return next;
}

withIosVisionOcr.renderVisionOcrSwift = renderVisionOcrSwift;
withIosVisionOcr.renderVisionOcrObjcBridge = renderVisionOcrObjcBridge;

module.exports = withIosVisionOcr;
