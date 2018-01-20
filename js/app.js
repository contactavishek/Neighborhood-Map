// Declaring global variables map, infowindow and bounds
var map;
var infoWindow;
var bounds;

// Google maps initialize function
function initMap() {
    var bangalore = {
        lat: 12.936033,
        lng: 77.605805
    };
 
    // Constructor creating a new map - center, zoom & mapTypeControl are required
    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 13,
        center: bangalore,
        mapTypeControl: false
    });

    infoWindow = new google.maps.InfoWindow();
    bounds = new google.maps.LatLngBounds();
   
    ko.applyBindings(new ViewModel());
}

// Alerting google map error
function googleMapsError() {
    alert('Error occurred with Google Maps!');
}

// Location Model 
var LocationMarker = function(data) {
    var self = this;

    this.title = data.title;
    this.position = data.location;
    this.street = '',
    this.city = '',
    
    this.visible = ko.observable(true);

    // Styling the markers a bit, this will be our listing marker icon
    var defaultIcon = makeMarkerIcon('0091ff');
    // Creating a "highlighted location" marker color for when the user
    // mouses over the marker
    var highlightedIcon = makeMarkerIcon('FFFF24');

    // My Foursquare API clientID and clientSecret
    var clientID = 'VVPCKXM3APHVJEE3HNCQ0I3T0ERPZHQC3IF4PZCT13QRGVLE';
    var clientSecret = 'K4CU3QP51J23FVK40CLG0A3S2HA3UPMJ354FW25J3YFDZLE1';

    // Getting JSON request of Foursquare data
    var requestURL = 'https://api.foursquare.com/v2/venues/search?ll=' + this.position.lat + ',' + 
    this.position.lng + '&client_id=' + clientID + '&client_secret=' + clientSecret + '&v=20130815' + '&query=' + this.title;

    $.getJSON(requestURL).done(function(data) {
		var results = data.response.venues[0];
        self.street = results.location.formattedAddress[0] ? results.location.formattedAddress[0]: 'N/A';
        self.city = results.location.formattedAddress[1] ? results.location.formattedAddress[1]: 'N/A';
        
    }).fail(function() { // Alerting if something went wrong with Foursquare API
        alert('Foursquare Error');
    });

    // Creating a marker per location, and putting into markers array
    this.marker = new google.maps.Marker({
        position: this.position,
        title: this.title,
        animation: google.maps.Animation.DROP,
        icon: defaultIcon
    });    

    self.filterMarkers = ko.computed(function () {
        // Setting marker and Extending bounds
        if(self.visible() === true) {
            self.marker.setMap(map);
            bounds.extend(self.marker.position);
            map.fitBounds(bounds);
        } else {
            self.marker.setMap(null);
        }
    });
    
    // Creating an onclick event to open an infowindow at each marker
    this.marker.addListener('click', function() {
        populateInfoWindow(this, self.street, self.city, infoWindow);
        toggleBounce(this);
        map.panTo(this.getPosition());
    });

    // Two event listeners - one for mouseover, one for mouseout,
    // to change the colors back and forth
    this.marker.addListener('mouseover', function() {
        this.setIcon(highlightedIcon);
    });
    this.marker.addListener('mouseout', function() {
        this.setIcon(defaultIcon);
    });

    // Showing location info when selected from list
    this.show = function(location) {
        google.maps.event.trigger(self.marker, 'click');
    };

    // Creating bounce effect when a marker is clicked
    this.bounce = function(place) {
		google.maps.event.trigger(self.marker, 'click');
	};

};

// View Model 
var ViewModel = function() {
    var self = this;

    this.searchItem = ko.observable('');

    this.mapList = ko.observableArray([]);

    // Adding location markers for each location
    locations.forEach(function(location) {
        self.mapList.push( new LocationMarker(location) );
    });

    // Locations viewed on map with search filter
    this.locationList = ko.computed(function() {
        var searchFilter = self.searchItem().toLowerCase();
        if (searchFilter) {
            return ko.utils.arrayFilter(self.mapList(), function(location) {
                var str = location.title.toLowerCase();
                var result = str.includes(searchFilter);
                location.visible(result);
				return result;
			});
        }
        self.mapList().forEach(function(location) {
            location.visible(true);
        });
        return self.mapList();
    }, self);
};

// This function populates the infowindow when the marker is clicked. I'll only allow
// one infowindow which will open at the marker that is clicked, and populate based
// on that markers position
function populateInfoWindow(marker, street, city, infowindow) {
    // Checking to make sure the infowindow is not already opened on this marker
    if (infowindow.marker != marker) {
        // Clearing the infowindow content to give the streetview time to load
        infowindow.setContent('');
        infowindow.marker = marker;

        // Making sure the marker property is cleared if the infowindow is closed.
        infowindow.addListener('closeclick', function() {
            infowindow.marker = null;
        });

        // Creating StreetViewService object
        var streetViewService = new google.maps.StreetViewService();
        // Defining radius of 50 meters so it can look for StreetView image within
        var radius = 50;
 
        // Populating Info windowcontent with street, city and title 
        var windowcontent = '<h4>' + marker.title + '</h4>' + 
            '<p>' + street + '<br>' + city + '<br>'+ "</p>";

        // In case the status is OK, which means the pano was found, computing the
        // position of the streetview image, then calculating the heading, then getting a
        // panorama from that and setting the options
        var getStreetView = function (data, status) {
            if (status == google.maps.StreetViewStatus.OK) {
                var nearStreetViewLocation = data.location.latLng;
                var heading = google.maps.geometry.spherical.computeHeading(
                    nearStreetViewLocation, marker.position);
                infowindow.setContent(windowcontent + '<div id="pano"></div>');
                var panoramaOptions = {
                    position: nearStreetViewLocation,
                    pov: {
                        heading: heading,
                        pitch: 30
                    }
                };

                var panorama = new google.maps.StreetViewPanorama(
                    document.getElementById('pano'), panoramaOptions);
            } else {
                infowindow.setContent(windowcontent + '<div>No Street View Found</div>');
            }
        };

        // Using streetview service to get the closest streetview image within
        // 50 meters of the markers position
        streetViewService.getPanoramaByLocation(marker.position, radius, getStreetView);
        // Opening the infowindow on the correct marker
        infowindow.open(map, marker);
    }
}

// Function to make the marker bounce
function toggleBounce(marker) {
  if (marker.getAnimation() !== null) {
    marker.setAnimation(null);
  } else {
    marker.setAnimation(google.maps.Animation.BOUNCE);
    setTimeout(function() {
        marker.setAnimation(null);
    }, 1200);
  }
}

// This function takes in a COLOR, and then creates a new marker
// icon of that color. The icon will be 21 px wide by 34 high, have an origin
// of 0, 0 and be anchored at 10, 34).
function makeMarkerIcon(markerColor) {
    var markerImage = new google.maps.MarkerImage(
        'http://chart.googleapis.com/chart?chst=d_map_spin&chld=1.15|0|' + markerColor +
        '|40|_|%E2%80%A2',
        new google.maps.Size(21, 34),
        new google.maps.Point(0, 0),
        new google.maps.Point(10, 34),
        new google.maps.Size(21, 34));
    return markerImage;
}
