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

  var rightNavbar = $("#right-navbar");
  rightNavbar.find(".loadWorkSpace").click(function () {
    onLoadWorkSpaceClicked();
  });

  rightNavbar.find(".saveWorkSpace").click(function () {
    onSaveWorkSpaceClicked();
  });

  rightNavbar.find(".showSettingsTab").click(function () {
    onSettingsClicked();
  });

  $("#navbar").find(".addTabPanel").click();

  log("App Ready!! ->" + CONFIG.DOMAIN_URL);

  waitingDialog.hide();
});

function onLoadWorkSpaceClicked() {
  showLoadFile(function(e) {
    try {
      var tabsConfigs = JSON.parse(e.target.result);
      if (!isNull(tabsConfigs) && tabsConfigs.length > 0){

        log("Loading workspace... nTabs: " + tabsConfigs.length);
        waitingDialog.show('Loading workspace...', { ignoreCalls: true });

        setTabConfigs (tabsConfigs);

      } else {
        showError("File is not supported as workspace", null, { ignoreCalls: true });
      }
    } catch (e) {
      showError("File is not supported as workspace", e);
      waitingDialog.hide({ ignoreCalls: true });
    }
  });
}

function onSaveWorkSpaceClicked() {
  var tabsConfigs = getTabsConfigs();
  if (tabsConfigs.length > 0){
    saveToFile ("workspace.wsp", JSON.stringify(tabsConfigs));
  } else {
    showMsg("Save workspace:", "No tabs for save");
  }
}

function onSettingsClicked() {
  showSettingsTabPanel($("#navbar").find("ul").first(), $(".daveContainer"));
}

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
  var plotConfigs = [];
  for (i in selectedPlots) {
    var plot = selectedPlots[i];
    var tab = getTabForSelector(plot.id);
    projectConfigs.push(tab.projectConfig);
    plotConfigs.push(plot.plotConfig);
  }

  addXdTabPanel($("#navbar").find("ul").first(), $(".daveContainer"), plotConfigs, projectConfigs);

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
    addFitTabPanel($("#navbar").find("ul").first(), $(".daveContainer"), plot.plotConfig, tab.projectConfig);

    setTimeout( function () {
      waitingDialog.hide();
    }, 850);
  } else {
    showError(null, "Can't find tab for plot: " + plot.id);
  }
}

function showMsg(title, msg) {
  var $msgDialog = $('<div id="msgdialog" title="' + title + '">' +
                      '<p>' + msg + '</p>' +
                    '</div>');
  $("body").append($msgDialog);
  $msgDialog.dialog({
     modal: true,
     buttons: {
       'OK': function() {
          $(this).dialog('close');
          $msgDialog.remove();
       }
     }
   });
   $msgDialog.parent().find(".ui-dialog-titlebar-close").html('<i class="fa fa-times" aria-hidden="true"></i>');
}

function showError(errorMsg, exception, options) {
  if (isNull(errorMsg)) { errorMsg = "Something went wrong!"; }

  waitingDialog.show(errorMsg, $.extend({ progressType: "warning" }, options ));
  setTimeout( function () {
    waitingDialog.hide(options);
  }, 2500);

  log(errorMsg + ((!isNull(exception))? " -> " + exception : ""));
}

function logError(errorMsg) {
  var logMsgs = errorMsg.split("#");
  for (i in logMsgs) {
    if (logMsgs[i] != "") {
      log(logMsgs[i]);
    }
  }
}

function getCheckedState(value) {
  return value ? 'checked="checked"' : "";
}

function setVisibility(element, visible) {
  if (visible) { element.show(); } else { element.hide(); }
}

function copyToClipboard(text) {
  const {clipboard} = require('electron');
  clipboard.writeText(text);
  showMsg("Copied to clipboard:", text);
}

function saveToFile (filename, contents) {
  var a = document.createElement("a");
  var file = new Blob([contents], {type: 'text/plain'});
  a.href = URL.createObjectURL(file);
  a.download = filename;
  a.click();
}

function showLoadFile(onLoadFn) {
  var input = $('<input type="file" id="load-input" />');
  input.on('change', function (e) {
    if (e.target.files.length == 1) {
      var file = e.target.files[0];
      var reader = new FileReader();
      reader.onload = function (e) { onLoadFn (e, file) };
      reader.readAsText(file);
    }
   });
   input.click();
}
