import UIKit
import MapKit
import CoreLocation
import React
import React_RCTAppDelegate

@objc(NativeMapView)
class NativeMapView: UIView, MKMapViewDelegate, CLLocationManagerDelegate {
  private var mapView: MKMapView!
  private var locationManager: CLLocationManager!
  private var currentLocation: CLLocation?
  private var userLocationMarker: MKPointAnnotation?
  
  @objc var onLocationUpdate: RCTDirectEventBlock?
  @objc var onMapReady: RCTDirectEventBlock?
  
  override init(frame: CGRect) {
    super.init(frame: frame)
    setupMapView()
    setupLocationManager()
  }
  
  required init?(coder: NSCoder) {
    super.init(coder: coder)
    setupMapView()
    setupLocationManager()
  }
  
  private func setupMapView() {
    mapView = MKMapView(frame: bounds)
    mapView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    mapView.delegate = self
    mapView.showsUserLocation = true
    mapView.userTrackingMode = .none
    addSubview(mapView)
    
    // Notify React Native that map is ready
    DispatchQueue.main.async {
      self.onMapReady?([:])
    }
  }
  
  private func setupLocationManager() {
    locationManager = CLLocationManager()
    locationManager.delegate = self
    locationManager.desiredAccuracy = kCLLocationAccuracyBest
    locationManager.distanceFilter = 10 // Update every 10 meters
    
    // Request location permission
    let status = locationManager.authorizationStatus
    if status == .notDetermined {
      locationManager.requestWhenInUseAuthorization()
    } else if status == .authorizedWhenInUse || status == .authorizedAlways {
      locationManager.startUpdatingLocation()
    }
  }
  
  @objc func requestLocationPermission() {
    let status = locationManager.authorizationStatus
    if status == .notDetermined {
      locationManager.requestWhenInUseAuthorization()
    } else if status == .authorizedWhenInUse || status == .authorizedAlways {
      locationManager.startUpdatingLocation()
    }
  }
  
  @objc func centerOnCurrentLocation() {
    guard let location = currentLocation else {
      // If no location yet, request permission and start updating
      requestLocationPermission()
      return
    }
    
    let region = MKCoordinateRegion(
      center: location.coordinate,
      latitudinalMeters: 1000,
      longitudinalMeters: 1000
    )
    mapView.setRegion(region, animated: true)
  }
  
  // MARK: - CLLocationManagerDelegate
  
  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    guard let location = locations.last else { return }
    currentLocation = location
    
    // Center map on current location
    let region = MKCoordinateRegion(
      center: location.coordinate,
      latitudinalMeters: 1000,
      longitudinalMeters: 1000
    )
    mapView.setRegion(region, animated: true)
    
    // Update user location marker
    if userLocationMarker == nil {
      userLocationMarker = MKPointAnnotation()
      userLocationMarker?.title = "Current Location"
      mapView.addAnnotation(userLocationMarker!)
    }
    userLocationMarker?.coordinate = location.coordinate
    
    // Send location update to React Native
    onLocationUpdate?([
      "latitude": location.coordinate.latitude,
      "longitude": location.coordinate.longitude,
      "accuracy": location.horizontalAccuracy,
      "timestamp": location.timestamp.timeIntervalSince1970 * 1000
    ])
  }
  
  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    print("Location error: \(error.localizedDescription)")
  }
  
  func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    let status = manager.authorizationStatus
    if status == .authorizedWhenInUse || status == .authorizedAlways {
      manager.startUpdatingLocation()
    }
  }
  
  // MARK: - MKMapViewDelegate
  
  func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
    if annotation is MKUserLocation {
      return nil // Use default user location view
    }
    
    let identifier = "LocationMarker"
    var annotationView = mapView.dequeueReusableAnnotationView(withIdentifier: identifier)
    
    if annotationView == nil {
      annotationView = MKMarkerAnnotationView(annotation: annotation, reuseIdentifier: identifier)
      annotationView?.canShowCallout = true
    } else {
      annotationView?.annotation = annotation
    }
    
    return annotationView
  }
  
  override func layoutSubviews() {
    super.layoutSubviews()
    mapView.frame = bounds
  }
}

@objc(NativeMapViewManager)
class NativeMapViewManager: RCTViewManager {
  override func view() -> UIView! {
    return NativeMapView()
  }
  
  override static func requiresMainQueueSetup() -> Bool {
    return true
  }
  
  @objc func requestLocationPermission(_ node: NSNumber) {
    DispatchQueue.main.async {
      if let bridge = self.bridge,
         let view = bridge.uiManager.view(forReactTag: node) as? NativeMapView {
        view.requestLocationPermission()
      }
    }
  }
  
  @objc func centerOnCurrentLocation(_ node: NSNumber) {
    DispatchQueue.main.async {
      if let bridge = self.bridge,
         let view = bridge.uiManager.view(forReactTag: node) as? NativeMapView {
        view.centerOnCurrentLocation()
      }
    }
  }
}



