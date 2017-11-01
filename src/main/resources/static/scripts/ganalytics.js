
function GoogleAnalyticsTracker (trackingId) {

  var currentObj = this;
  this.trackingId = trackingId;
  this.clientId = null;
  this.measurementRestApiUrl = 'https://ssl.google-analytics.com/collect';

  this.sendEvent = function(category, action, label) {
    $.post(this.measurementRestApiUrl, {
        "t":    "event",
        "ec":   category,
        "ea":   action,
        "el":   label,
        "v":    "1",
        "tid":  this.trackingId,
        "cid":  ((!isNull(this.clientId) && (this.clientId != "")) ? this.clientId : "anonymous"),
        "z": (new Date()).getTime()
    });
  };

  this.sendPage = function(pageName) {
    $.post(this.measurementRestApiUrl, {
        "t":    "pageview",
        "dp":   pageName,
        "v":    "1",
        "tid":  this.trackingId,
        "cid":  ((!isNull(this.clientId) && (this.clientId != "")) ? this.clientId : "anonymous"),
        "z": (new Date()).getTime()
    });
  };

  this.init = function () {
    new Fingerprint2().get(function(uniqueUserId, userData){
      currentObj.clientId = uniqueUserId;

      //Send user data for analysis
      for (var i = 0; i < 15; i ++) {
        currentObj.sendEvent("UserData", userData[i].key, JSON.stringify(userData[i].value));
      }
    });
  }

  return this;
}

var gaTracker = new GoogleAnalyticsTracker("UA-108661407-2");
gaTracker.init();

//trackEvent("bla", "bla1", "bla2");
