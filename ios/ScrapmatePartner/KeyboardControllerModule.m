#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(KeyboardControllerModule, RCTEventEmitter)

RCT_EXTERN_METHOD(dismissKeyboard:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(setEnabled:(BOOL)enabled)

@end





