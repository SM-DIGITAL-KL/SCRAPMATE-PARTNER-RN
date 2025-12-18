#import <React/RCTViewManager.h>
#import <UIKit/UIKit.h>

@interface RCT_EXTERN_MODULE(NativeGestureHandlerViewManager, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(onGestureEvent, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(enablePanGesture, BOOL)
RCT_EXPORT_VIEW_PROPERTY(enableTapGesture, BOOL)
RCT_EXPORT_VIEW_PROPERTY(enableLongPressGesture, BOOL)

@end





