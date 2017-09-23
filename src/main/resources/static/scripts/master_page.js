var theService = null;

//----------- MAIN ENTRY POINT  -----------------
$(document).ready(function () {
  waitingDialog.show('Creating environment');

  Logger.show();
  logInfo("App started!! ->" + CONFIG.DOMAIN_URL);

  theService = new Service(CONFIG.DOMAIN_URL);
  theService.subscribe_to_server_messages(onServerMessageReceived);
  updateServerConfig();

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

  logInfo("App Ready!! ->" + CONFIG.DOMAIN_URL);

  waitingDialog.hide();
});



//----------- GLOBAL EVENTS  -----------------
function onLoadWorkSpaceClicked() {
  showLoadFile(function(e, file) {
    try {
      if (!isNull(e)) {
        var tabsConfigs = JSON.parse(e.target.result);
        if (!isNull(tabsConfigs) && tabsConfigs.length > 0){

          logInfo("Loading workspace... nTabs: " + tabsConfigs.length);
          waitingDialog.show('Loading workspace...', { ignoreCalls: true });

          setTabConfigs (tabsConfigs);
          return;
        }
      }

      //Else show error:
      showError("File: " + file.name + " is not supported as workspace", null, { ignoreCalls: true });

    } catch (e) {
      showError("File: " + file.name + " is not supported as workspace", e);
      waitingDialog.hide({ ignoreCalls: true });
    }
  }, ".wsp");
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

  addXsTabPanel($("#navbar").find("ul").first(), $(".daveContainer"), plotConfigs, projectConfigs);
  hideWaitingDialogDelayed(850, true);
}

function onFitPlotClicked(plot) {
  logInfo("onFitPlotClicked: plot -> " + plot.id);
  prepareNewTab(plot, addFitTabPanel, false);
}

function onBaselinePlotSelected(plot) {
  logInfo("onBaselinePlotSelected, PlotId: " + plot.id);
  plot.btnSettings.click();
  plot.setBaselineEnabled(true);
  plot.btnBack.click();
}

function onAGNPlotSelected(plot) {
  logInfo("onAGNPlotSelected, PlotId: " + plot.id);
  prepareNewTab(plot, addAGNTabPanel, true);
}

function onPeriodogramPlotSelected(plot) {
  logInfo("onPeriodogramPlotSelected, PlotId: " + plot.id);
  prepareNewTab(plot, addPGTabPanel, true);
}

function onPhaseogramPlotSelected(plot) {
  logInfo("onPhaseogramPlotSelected, PlotId: " + plot.id);
  prepareNewTab(plot, addPHTabPanel, true);
}

function prepareNewTab(plot, addTabFn, clearSelectedPlots) {
  logDebug("prepareNewTab: plot -> " + plot.id);

  waitingDialog.show('Preparing new tab ...');
  var tab = getTabForSelector(plot.id);
  if (!isNull(tab)) {
    addTabFn($("#navbar").find("ul").first(), $(".daveContainer"), plot.plotConfig, tab.projectConfig);
    hideWaitingDialogDelayed(850, clearSelectedPlots);
  } else {
    showError(null, "Can't find tab for plot: " + plot.id);
  }
}



//----------- DIALOG METHODS  -----------------
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

function hideWaitingDialogDelayed (delay, clearPlots) {
  setTimeout( function () {
    if (clearPlots) { ClearSelectedPlots(); }
    waitingDialog.hide();
  }, delay);
}

function showError(errorMsg, exception, options) {
  if (isNull(errorMsg)) { errorMsg = "Something went wrong!"; }

  waitingDialog.show(errorMsg, $.extend({ progressType: "warning" }, options ));
  setTimeout( function () {
    waitingDialog.hide(options);
  }, 2500);

  logError(errorMsg + ((!isNull(exception))? " -> " + exception : ""));
}



//----------- CROSS GUI & SERVER METHODS  -----------------
function disableLogError() {
  //Used to avoid python outputs to block electron process
  sendEventToElectron("disableLogError");
}

function enableLogError() {
  sendEventToElectron("enableLogError");
}

function logError(errorMsg) {
  var logMsgs = errorMsg.split("#");
  for (i in logMsgs) {
    if (logMsgs[i] != "") {
      var msg = logMsgs[i];
      var msgLower = msg.substring(0, 30).toLowerCase();
      if (msgLower.indexOf("::") > -1) {
        log(msg, "LogServerDebug");
      } else if (msgLower.indexOf("info") > -1) {
        log(msg, "LogServerInfo");
      } else if (msgLower.indexOf("warn") > -1) {
        log(msg, "LogServerWarn");
      } else  {
        log(msg, "LogServerError");
      }
    }
  }
}

function connectionLost() {
  logErr("Connection lost with Python Server!");
  waitingDialog.hide({ignoreCalls: true});
  setTimeout( function () {

    waitingDialog.show("Connection lost with Python Server! Reconnecting ...", { progressType: "warning", ignoreCalls: true });
    sendEventToElectron("relaunchServer");
    reconnectToServer();

  }, 2500);
}

function sendEventToElectron (event) {
  const { ipcRenderer } = require('electron');
  ipcRenderer.send(event);
}

function reconnectToServer (){
  logErr("Connection lost with Python Server. Reconnecting ...");
  UrlExists(CONFIG.DOMAIN_URL, function(status){
      if(status === 200){
         waitingDialog.hide({ignoreCalls: true});
         sendEventToElectron("connectedToServer");
         logInfo("Connected to Python Server!");
      } else {
         setTimeout( function () { reconnectToServer (); }, 1000);
      }
  });
}

function onServerMessageReceived (msg) {
  cssClass = "LogServerDebug";
  var msgLower = msg.substring(0, 30).toLowerCase();
  if (msgLower.startsWith("info:")){
    cssClass = "LogServerInfo";
  } else if (msgLower.startsWith("warn:") || msgLower.startsWith("warning:")){
    cssClass = "LogServerWarn";
  } else if (msgLower.startsWith("error:")){
    cssClass = "LogServerError";
  }
  log("SERVER -> " + msg, cssClass);
}

function updateServerConfig(){
  theService.set_config({ CONFIG: CONFIG }, function (res) {
    logInfo("Server configuration setted -> " + res);
  })
}
