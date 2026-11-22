const fs = require('node:fs');
const path = require('node:path');

const MLKIT_TEXT_RECOG_DEP = 'com.google.mlkit:text-recognition:16.0.1';
const TESSERACT_OCR_DEP = 'cz.adaptech.tesseract4android:tesseract4android:4.7.0';

function patchAppBuildGradle(contents) {
  let src = String(contents || '');
  const missingDeps = [];
  if (!src.includes('com.google.mlkit:text-recognition')) {
    missingDeps.push(MLKIT_TEXT_RECOG_DEP);
  }
  if (!src.includes('cz.adaptech.tesseract4android:tesseract4android')) {
    missingDeps.push(TESSERACT_OCR_DEP);
  }
  if (missingDeps.length === 0) {
    return src;
  }
  const depsLines = missingDeps.map((d) => `\n    implementation("${d}")`).join('');
  const depsMatch = src.match(/dependencies\s*\{/);
  if (depsMatch && depsMatch.index !== undefined) {
    const insertAt = depsMatch.index + depsMatch[0].length;
    return src.slice(0, insertAt) + depsLines + src.slice(insertAt);
  }
  return `${src}\n\ndependencies {${depsLines}\n}\n`;
}

function renderMlkitOcrModuleKt(packageName = 'com.incifact.app') {
  return `package ${packageName}

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import com.googlecode.tesseract.android.TessBaseAPI
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException

class MlkitOcrModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  private val ocrExecutor = Executors.newSingleThreadExecutor()

  override fun getName(): String = "MlkitOcr"

  override fun invalidate() {
    super.invalidate()
    try {
      ocrExecutor.shutdownNow()
    } catch (_: Exception) {
    }
  }

  @ReactMethod
  fun detectFromUri(uriStr: String?, promise: Promise) {
    detectFromUriWithLang(uriStr, "en", promise)
  }

  @ReactMethod
  fun detectFromUriWithLang(uriStr: String?, langHint: String?, promise: Promise) {
    if (uriStr.isNullOrBlank()) {
      promise.reject("OCR_INVALID_URI", "Image URI is empty.")
      return
    }

    val normalizedLang = (langHint ?: "en").trim().lowercase()
    val tessCode = when {
      normalizedLang.startsWith("ar") -> "ara"
      normalizedLang.startsWith("ur") -> "urd"
      normalizedLang.startsWith("ru") -> "rus"
      else -> null
    }

    val parsedUri = if (uriStr.startsWith("/")) Uri.parse("file://$uriStr") else Uri.parse(uriStr)
    if (tessCode != null) {
      runTesseractScriptOcr(parsedUri, tessCode, promise)
      return
    }

    runMlkitLatinOcr(parsedUri, promise, null, null)
  }

  private fun runMlkitLatinOcr(
    parsedUri: Uri,
    promise: Promise,
    onEmptyErrorCode: String?,
    onEmptyErrorMessage: String?
  ) {
    try {
      val image = InputImage.fromFilePath(reactApplicationContext, parsedUri)
      val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

      recognizer.process(image)
        .addOnSuccessListener { visionText ->
          val collectedLines = visionText.textBlocks
            .flatMap { block -> block.lines }
            .sortedWith(
              compareBy<com.google.mlkit.vision.text.Text.Line>(
                { it.boundingBox?.top ?: 0 },
                { it.boundingBox?.left ?: 0 }
              )
            )

          val out = Arguments.createArray()
          for (line in collectedLines) {
            val text = line.text.trim()
            if (text.isEmpty()) continue
            val map = Arguments.createMap()
            map.putString("text", text)
            val box = line.boundingBox
            if (box != null) {
              map.putInt("top", box.top)
              map.putInt("left", box.left)
              map.putInt("width", box.width())
              map.putInt("height", box.height())
            }
            val conf = line.confidence
            if (conf >= 0f && !conf.isNaN()) {
              map.putDouble("confidence", conf.toDouble())
            }
            out.pushMap(map)
          }
          recognizer.close()
          if (out.size() == 0 && onEmptyErrorCode != null) {
            promise.reject(onEmptyErrorCode, onEmptyErrorMessage ?: "Offline OCR script model missing.")
          } else {
            promise.resolve(out)
          }
        }
        .addOnFailureListener { err ->
          recognizer.close()
          if (onEmptyErrorCode != null) {
            promise.reject(onEmptyErrorCode, onEmptyErrorMessage ?: err.message ?: "Offline OCR script model missing.")
          } else {
            promise.reject("OCR_RECOGNITION_FAILED", err.message ?: "ML Kit recognition failed.")
          }
        }
    } catch (err: Exception) {
      if (onEmptyErrorCode != null) {
        promise.reject(onEmptyErrorCode, onEmptyErrorMessage ?: err.message ?: "Offline OCR script model missing.")
      } else {
        promise.reject("OCR_RECOGNITION_FAILED", err.message ?: "Failed to prepare image for OCR.")
      }
    }
  }

  private fun decodeDownsampledOrientedBitmap(parsedUri: Uri, maxDimension: Int = 2048): Bitmap? {
    val boundsOpts = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    reactApplicationContext.contentResolver.openInputStream(parsedUri)?.use { stream ->
      BitmapFactory.decodeStream(stream, null, boundsOpts)
    }
    var sampleSize = 1
    val srcMax = maxOf(boundsOpts.outWidth, boundsOpts.outHeight)
    while (srcMax > 0 && srcMax / sampleSize > maxDimension) {
      sampleSize *= 2
    }

    val decodeOpts = BitmapFactory.Options().apply {
      inSampleSize = sampleSize
      inPreferredConfig = Bitmap.Config.ARGB_8888
    }
    val decoded = reactApplicationContext.contentResolver.openInputStream(parsedUri)?.use { stream ->
      BitmapFactory.decodeStream(stream, null, decodeOpts)
    } ?: return null

    var rotationDeg = 0f
    try {
      reactApplicationContext.contentResolver.openInputStream(parsedUri)?.use { exifStream ->
        val exif = ExifInterface(exifStream)
        val orientation = exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
        rotationDeg = when (orientation) {
          ExifInterface.ORIENTATION_ROTATE_90 -> 90f
          ExifInterface.ORIENTATION_ROTATE_180 -> 180f
          ExifInterface.ORIENTATION_ROTATE_270 -> 270f
          else -> 0f
        }
      }
    } catch (_: Exception) {
    }

    if (rotationDeg == 0f) {
      return decoded
    }
    val matrix = Matrix().apply { postRotate(rotationDeg) }
    val rotated = Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, matrix, true)
    if (rotated != decoded) {
      decoded.recycle()
    }
    return rotated
  }

  private fun ensureTessdataFile(tessCode: String): File? {
    val tessDir = File(reactApplicationContext.filesDir, "tessdata")
    if (!tessDir.exists()) tessDir.mkdirs()
    val modelFile = File(tessDir, "$tessCode.traineddata")
    if (modelFile.exists() && modelFile.length() > 1024L) {
      return modelFile
    }
    val tmpFile = File(tessDir, "$tessCode.traineddata.tmp")
    return try {
      reactApplicationContext.assets.open("tessdata/$tessCode.traineddata").use { input ->
        FileOutputStream(tmpFile).use { output ->
          input.copyTo(output)
        }
      }
      if (tmpFile.exists() && tmpFile.length() > 1024L && (tmpFile.renameTo(modelFile) || modelFile.exists())) {
        modelFile
      } else {
        tmpFile.delete()
        null
      }
    } catch (_: Exception) {
      tmpFile.delete()
      null
    }
  }

  private fun runTesseractScriptOcr(parsedUri: Uri, tessCode: String, promise: Promise) {
    try {
      ocrExecutor.execute {
        var tessApi: TessBaseAPI? = null
        var bitmap: Bitmap? = null
        try {
          val modelFile = ensureTessdataFile(tessCode)
          if (modelFile == null) {
            // Fallback to ML Kit Latin so English/INCI labels still scan cleanly when non-Latin traineddata is absent
            runMlkitLatinOcr(
              parsedUri,
              promise,
              "OCR_SCRIPT_MODEL_MISSING",
              "Offline traineddata for $tessCode is not installed on this device."
            )
            return@execute
          }

          bitmap = decodeDownsampledOrientedBitmap(parsedUri, 2048)
          if (bitmap == null) {
            promise.reject("OCR_IMAGE_LOAD_FAILED", "Could not decode image for multi-script OCR.")
            return@execute
          }

          val hasEng = ensureTessdataFile("eng") != null
          val tessLangSpec = if (hasEng) "$tessCode+eng" else tessCode

          tessApi = TessBaseAPI()
          val dataParentPath = reactApplicationContext.filesDir.absolutePath
          if (!tessApi.init(dataParentPath, tessLangSpec)) {
            promise.reject("OCR_SCRIPT_MODEL_MISSING", "Failed to initialize Tesseract model $tessLangSpec.")
            return@execute
          }
          tessApi.setImage(bitmap)
          val rawText = tessApi.getUTF8Text() ?: ""
          val meanConf = tessApi.meanConfidence().toDouble() / 100.0

          val out = Arguments.createArray()
          for (rawLine in rawText.lines()) {
            val line = rawLine.trim()
            if (line.isEmpty()) continue
            val map = Arguments.createMap()
            map.putString("text", line)
            if (meanConf > 0.0 && !meanConf.isNaN()) {
              map.putDouble("confidence", meanConf.coerceIn(0.0, 1.0))
            }
            out.pushMap(map)
          }
          promise.resolve(out)
        } catch (err: Exception) {
          promise.reject("OCR_RECOGNITION_FAILED", err.message ?: "Tesseract multi-script OCR failed.")
        } finally {
          try {
            bitmap?.recycle()
          } catch (_: Exception) {
          }
          try {
            tessApi?.recycle()
          } catch (_: Exception) {
          }
        }
      }
    } catch (_: RejectedExecutionException) {
      promise.reject("OCR_CANCELLED", "OCR module is shutting down.")
    }
  }
}
`;
}

function renderMlkitOcrPackageKt(packageName = 'com.incifact.app') {
  return `package ${packageName}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class MlkitOcrPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(MlkitOcrModule(reactContext))

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
    emptyList()
}
`;
}

function patchMainApplication(contents, packageName = 'com.incifact.app') {
  let src = String(contents || '');
  if (src.includes('MlkitOcrPackage')) {
    return src;
  }

  // Ensure package import if MainApplication sits in another package
  if (!src.includes(`package ${packageName}`) && !src.includes(`import ${packageName}.MlkitOcrPackage`)) {
    const pkgMatch = src.match(/^package\s+[^\r\n]+/m);
    if (pkgMatch && pkgMatch.index !== undefined) {
      const idx = pkgMatch.index + pkgMatch[0].length;
      src = src.slice(0, idx) + `\nimport ${packageName}.MlkitOcrPackage` + src.slice(idx);
    }
  }

  // Kotlin Expo/RN template: PackageList(this).packages.apply { ... }
  const applyMatch = src.match(/PackageList\(this\)\.packages\.apply\s*\{/);
  if (applyMatch && applyMatch.index !== undefined) {
    const insertAt = applyMatch.index + applyMatch[0].length;
    return src.slice(0, insertAt) + `\n              add(MlkitOcrPackage())` + src.slice(insertAt);
  }

  // Fallback Kotlin without .apply
  const retPackagesMatch = src.match(/return\s+PackageList\(this\)\.packages/);
  if (retPackagesMatch && retPackagesMatch.index !== undefined) {
    return (
      src.slice(0, retPackagesMatch.index) +
      'return PackageList(this).packages.apply {\n              add(MlkitOcrPackage())\n            }' +
      src.slice(retPackagesMatch.index + retPackagesMatch[0].length)
    );
  }

  // Fallback Java MainApplication
  const javaPackagesMatch = src.match(/List<ReactPackage>\s+packages\s*=\s*new\s+PackageList\(this\)\.getPackages\(\);/);
  if (javaPackagesMatch && javaPackagesMatch.index !== undefined) {
    const insertAt = javaPackagesMatch.index + javaPackagesMatch[0].length;
    return src.slice(0, insertAt) + `\n      packages.add(new MlkitOcrPackage());` + src.slice(insertAt);
  }

  return src;
}

function withAndroidMlkitOcr(config) {
  const {
    withAppBuildGradle,
    withMainApplication,
    withDangerousMod
  } = require('@expo/config-plugins');

  const packageName = (config.android && config.android.package) || 'com.incifact.app';

  let next = withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = patchAppBuildGradle(cfg.modResults.contents);
    return cfg;
  });

  next = withMainApplication(next, (cfg) => {
    cfg.modResults.contents = patchMainApplication(cfg.modResults.contents, packageName);
    return cfg;
  });

  next = withDangerousMod(next, [
    'android',
    async (cfg) => {
      const pkgRel = packageName.split('.').join(path.sep);
      const targetDir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'java', pkgRel);
      fs.mkdirSync(targetDir, { recursive: true });
      fs.writeFileSync(path.join(targetDir, 'MlkitOcrModule.kt'), renderMlkitOcrModuleKt(packageName), 'utf8');
      fs.writeFileSync(path.join(targetDir, 'MlkitOcrPackage.kt'), renderMlkitOcrPackageKt(packageName), 'utf8');
      return cfg;
    }
  ]);

  return next;
}

withAndroidMlkitOcr.MLKIT_TEXT_RECOG_DEP = MLKIT_TEXT_RECOG_DEP;
withAndroidMlkitOcr.TESSERACT_OCR_DEP = TESSERACT_OCR_DEP;
withAndroidMlkitOcr.patchAppBuildGradle = patchAppBuildGradle;
withAndroidMlkitOcr.renderMlkitOcrModuleKt = renderMlkitOcrModuleKt;
withAndroidMlkitOcr.renderMlkitOcrPackageKt = renderMlkitOcrPackageKt;
withAndroidMlkitOcr.patchMainApplication = patchMainApplication;

module.exports = withAndroidMlkitOcr;
