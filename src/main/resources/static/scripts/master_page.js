var theService = null;

$(document).ready(function () {
  waitingDialog.show('Creating environment');

  Logger.show();
  log("App started!! ->" + CONFIG.DOMAIN_URL);

  theService = new Service(CONFIG.DOMAIN_URL);
  theService.subscribe_to_server_messages(onServerMessageReceived);

  $("#navbar").find(".addTabPanel").click(function () {
    addWfTabPanel($("#navbar").find("ul").first(), $(".daveContainer"));
  });

  $("#right-navbar").find(".showSettingsTab").click(function () {
    onSettingsClicked();
  });

  $("#navbar").find(".addTabPanel").click();

  log("App Ready!! ->" + CONFIG.DOMAIN_URL);

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

function isInt(n) {
   return n % 1 === 0;
}

function fixedPrecision(value, precision) {
   return (precision > 0) ? parseFloat(value.toFixed(precision)) : Math.floor(value);
}

function getInputIntValue($input, defaultValue) {
  return getInputValue($input, "int", defaultValue);
}

function getInputIntValueCropped ($input, defaultValue, min, max) {
  var value = Math.min(Math.max(getInputIntValue($input, defaultValue), min), max);
  $input.val(value).removeClass("wrongValue");
  return value;
}

function getInputFloatValue($input, defaultValue) {
  return getInputValue($input, "float", defaultValue);
}

function getInputFloatValueCropped ($input, defaultValue, min, max) {
  var value = Math.min(Math.max(getInputFloatValue($input, defaultValue), min), max);
  $input.val(value).removeClass("wrongValue");
  return value;
}

function getInputValue($input, type, defaultValue) {
  try {

      var value = NaN;
      var textVal = $input.val().replace(",", ".");
      $input.val(textVal);

      if (type == "float") {
        value = parseFloat(textVal);
      } else if (type == "int") {
        value = parseInt(textVal);
      }

      if (jQuery.isNumeric(textVal) && !isNaN(value)) {
        $input.removeClass("wrongValue");
        return value;
      } else {
        $input.addClass("wrongValue");
        return defaultValue;
      }

  } catch (e) {
    $input.addClass("wrongValue");
    return defaultValue;
  }
}

function fillWithZeros(num, length) {
  num = ""+num;
  while(num.length < length) num = "0"+num;
  return num;
}

function closest(arr, closestTo){
    var closest = Math.max.apply(null, arr);
    for(var i = 0; i < arr.length; i++){
        if(arr[i] >= closestTo && arr[i] < closest) closest = arr[i];
    }
    return closest;
}

function onMultiplePlotsSelected(selectedPlots) {
  log("onMultiplePlotsSelected: selectedPlots -> " + selectedPlots.length);

  waitingDialog.show('Preparing new tab ...');

  var projectConfigs = [];
  for (i in selectedPlots) {
    var tab = getTabForSelector(selectedPlots[i].id);
    projectConfigs.push(tab.projectConfig);
  }

  addXdTabPanel($("#navbar").find("ul").first(), $(".daveContainer"), selectedPlots, projectConfigs);

  setTimeout( function () {
    ClearSelectedPlots();
    waitingDialog.hide();
  }, 850);
}

function onFitPlotClicked(plot) {
  log("onFitPlotClicked: plot -> " + plot.id);

  waitingDialog.show('Preparing new tab ...');

  var tab = getTabForSelector(plot.id);
  if (!isNull(tab)) {
    addFitTabPanel($("#navbar").find("ul").first(), $(".daveContainer"), plot, tab.projectConfig);

    setTimeout( function () {
      waitingDialog.hide();
    }, 850);
  } else {
    showError(null, "Can't find tab for plot: " + plot.id);
  }
}

function onSettingsClicked() {
  showSettingsTabPanel($("#navbar").find("ul").first(), $(".daveContainer"));
}

function showError(errorMsg, exception) {

  if (isNull(errorMsg)) { errorMsg = "Something went wrong!"; }

  waitingDialog.show(errorMsg, { progressType:"warning" });
  log(errorMsg + ((!isNull(exception))? " -> " + exception : ""));

  setTimeout( function () {
    waitingDialog.hide();
  }, 1600);
}

function getCheckedState(value) {
  return value ? 'checked="checked"' : "";
}

function copyToClipboard(text) {
  const {clipboard} = require('electron');
  clipboard.writeText(text);
  alert("Copied to clipboard:\n" + text);
}
