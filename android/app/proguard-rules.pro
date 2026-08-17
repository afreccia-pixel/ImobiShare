# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.

# Capacitor Plugin & Bridge rules
-keep public class * extends com.getcapacitor.Plugin
-keep public class * extends com.getcapacitor.BridgeActivity
-keep class com.getcapacitor.** { *; }
-keepclassmembers class * implements com.getcapacitor.PluginMethod {
    public *;
}

# Android & Google Services optimizations
-dontwarn com.google.android.gms.**
-dontwarn androidx.**

