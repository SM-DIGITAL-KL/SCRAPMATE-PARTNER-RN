#import <React/RCTViewManager.h>
#import <React/RCTUIManager.h>
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(NativeMapViewManager, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(onLocationUpdate, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onMapReady, RCTDirectEventBlock)

RCT_EXTERN_METHOD(requestLocationPermission:(nonnull NSNumber *)node)
RCT_EXTERN_METHOD(centerOnCurrentLocation:(nonnull NSNumber *)node)

@end





