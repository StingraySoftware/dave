
var DOMAIN_URL = "http://localhost:5000"; //Set as Dave Server Ip:Port
var MIN_PLOT_POINTS = 2;
var MAX_PLOT_POINTS = 10000;

var theService = null;

$(document).ready(function () {
  waitingDialog.show('Creating environment');

  Logger.show();
  log("App started!! ->" + DOMAIN_URL);

  theService = new Service (DOMAIN_URL);
  theService.subscribe_to_server_messages(onServerMessageReceived);

  $("#navbar").find(".addTabPanel").bind("click", function( event ) {
    addTabPanel($("#navbar").find("ul").first(), $(".daveContainer"));
  });

  $("#navbar").find(".addTabPanel").click();

  log("App Ready!! ->" + DOMAIN_URL);

  waitingDialog.hide();
});

function cloneHtmlElement(id, classSelector) {
  return $("." + classSelector).clone().removeClass(classSelector).addClass(id);
}

function onServerMessageReceived (msg) {
  log("SERVER -> " + msg);
}

function isNull (value) {
  return (value === undefined) || (value == null);
}
