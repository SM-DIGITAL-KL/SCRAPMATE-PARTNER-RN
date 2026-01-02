# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# ============================================
# Firebase Cloud Messaging (FCM) ProGuard Rules
# ============================================
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# Keep Firebase Messaging classes
-keep class com.google.firebase.messaging.** { *; }
-keep class com.google.firebase.iid.** { *; }

# Keep Firebase Messaging Service
-keep class * extends com.google.firebase.messaging.FirebaseMessagingService {
    <init>(...);
}

# Keep Firebase Instance ID
-keep class com.google.firebase.iid.FirebaseInstanceId { *; }
-keep class com.google.firebase.iid.FirebaseInstanceIdService { *; }

# Keep Firebase Installations (required for FCM)
-keep class com.google.firebase.installations.** { *; }

# Keep Firebase Analytics (required for FCM)
-keep class com.google.firebase.analytics.** { *; }

# Keep Firebase Components
-keep class com.google.firebase.components.** { *; }

# Keep Firebase Tasks
-keep class com.google.android.gms.tasks.** { *; }

# Keep Firebase Messaging metadata
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes Exceptions
-keepattributes EnclosingMethod

# ============================================
# React Native Firebase ProGuard Rules
# ============================================
# Keep React Native Firebase classes
-keep class io.invertase.firebase.** { *; }
-keep class io.invertase.firebase.messaging.** { *; }
-keep class io.invertase.firebase.common.** { *; }

# Keep React Native Firebase native modules
-keep class * implements io.invertase.firebase.interfaces.NativeModule { *; }

# Keep React Native Firebase messaging service
-keep class io.invertase.firebase.messaging.ReactNativeFirebaseMessagingService { *; }

# Keep React Native Firebase messaging receiver
-keep class io.invertase.firebase.messaging.ReactNativeFirebaseMessagingReceiver { *; }

# Keep React Native Firebase messaging module
-keep class io.invertase.firebase.messaging.ReactNativeFirebaseMessagingModule { *; }

# Keep React Native Firebase app module
-keep class io.invertase.firebase.app.ReactNativeFirebaseAppModule { *; }

# Keep React Native Firebase package
-keep class io.invertase.firebase.ReactNativeFirebaseAppPackage { *; }
-keep class io.invertase.firebase.messaging.ReactNativeFirebaseMessagingPackage { *; }

# Keep React Native Firebase JSON classes
-keep class io.invertase.firebase.common.** { *; }

# Keep React Native Firebase utils
-keep class io.invertase.firebase.utils.** { *; }

# Keep React Native Firebase interfaces
-keep interface io.invertase.firebase.interfaces.** { *; }

# ============================================
# React Native ProGuard Rules
# ============================================

# Keep React Native classes
-keep,allowobfuscation @interface com.facebook.proguard.annotations.DoNotStrip
-keep,allowobfuscation @interface com.facebook.proguard.annotations.KeepGettersAndSetters
-keep @com.facebook.proguard.annotations.DoNotStrip class *
-keepclassmembers class * {
    @com.facebook.proguard.annotations.DoNotStrip *;
}
-keepclassmembers @com.facebook.proguard.annotations.KeepGettersAndSetters class * {
    void set*(***);
    *** get*();
}

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep React Native classes
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }

# Keep React Native Bridge
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.uimanager.** { *; }
-keep class com.facebook.react.views.** { *; }

# Keep React Native modules
-keep class com.facebook.react.modules.** { *; }

# Keep React Native TurboModules
-keep class com.facebook.react.turbomodule.** { *; }

# Keep React Native Fabric
-keep class com.facebook.react.fabric.** { *; }

# Keep React Native View Managers
-keep class * extends com.facebook.react.uimanager.ViewManager {
    <init>(...);
}

# Keep React Native Package classes
-keep class * implements com.facebook.react.ReactPackage { *; }

# Keep React Native Native Modules
-keep class * implements com.facebook.react.bridge.NativeModule { *; }

# Keep React Native View Managers
-keep class * extends com.facebook.react.uimanager.SimpleViewManager { *; }
-keep class * extends com.facebook.react.uimanager.ViewGroupManager { *; }

# Keep React Native Component classes
-keep class * extends com.facebook.react.uimanager.ViewManager {
    <init>(...);
}

# Keep React Native annotations
-keep @com.facebook.react.bridge.ReactMethod class *
-keepclassmembers class * {
    @com.facebook.react.bridge.ReactMethod *;
}

# Keep React Native JavaScript interface
-keepclassmembers class * {
    @com.facebook.react.bridge.ReactMethod *;
}

# ============================================
# React Navigation
# ============================================
-keep class com.swmansion.** { *; }
-keep class com.swmansion.gesturehandler.** { *; }
-keep class com.swmansion.reanimated.** { *; }

# ============================================
# React Native Vector Icons
# ============================================
-keep class com.oblador.vectoricons.** { *; }

# ============================================
# React Native Safe Area Context
# ============================================
-keep class com.th3rdwave.safeareacontext.** { *; }

# ============================================
# React Native Screens
# ============================================
-keep class com.swmansion.rnscreens.** { *; }

# ============================================
# React Native Linear Gradient
# ============================================
-keep class com.BV.LinearGradient.** { *; }

# ============================================
# React Native WebView
# ============================================
-keep class com.reactnativecommunity.webview.** { *; }

# ============================================
# React Native Image Picker
# ============================================
-keep class com.imagepicker.** { *; }

# ============================================
# React Native Document Picker
# ============================================
-keep class com.reactnativedocumentpicker.** { *; }

# ============================================
# AsyncStorage
# ============================================
-keep class com.reactnativecommunity.asyncstorage.** { *; }

# ============================================
# React Native Gesture Handler
# ============================================
-keep class com.swmansion.gesturehandler.** { *; }
-keep class com.swmansion.reanimated.** { *; }

# ============================================
# Keep application classes
# ============================================
-keep class com.app.scrapmatepartner.** { *; }

# ============================================
# Keep native methods for JNI
# ============================================
-keepclasseswithmembernames class * {
    native <methods>;
}

# ============================================
# Keep Parcelable implementations
# ============================================
-keepclassmembers class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator CREATOR;
}

# ============================================
# Keep Serializable classes
# ============================================
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# ============================================
# Keep enums
# ============================================
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# ============================================
# Keep R class
# ============================================
-keepclassmembers class **.R$* {
    public static <fields>;
}

# ============================================
# Keep annotations
# ============================================
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes Exceptions
-keepattributes InnerClasses
-keepattributes EnclosingMethod

# ============================================
# Keep line numbers for stack traces
# ============================================
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ============================================
# Remove logging in release builds
# ============================================
-assumenosideeffects class android.util.Log {
    public static boolean isLoggable(java.lang.String, int);
    public static int v(...);
    public static int i(...);
    public static int w(...);
    public static int d(...);
    public static int e(...);
}

# ============================================
# Keep Kotlin metadata
# ============================================
-keepattributes RuntimeVisibleAnnotations
-keepattributes RuntimeVisibleParameterAnnotations
-keepattributes AnnotationDefault

# ============================================
# Keep Kotlin coroutines
# ============================================
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
-keepclassmembers class kotlinx.** {
    volatile <fields>;
}

# ============================================
# Optimization settings
# ============================================
-optimizationpasses 5
-dontusemixedcaseclassnames
-dontskipnonpubliclibraryclasses
-verbose

# ============================================
# Repackage classes
# ============================================
-repackageclasses ''
-allowaccessmodification
-optimizations !code/simplification/arithmetic
