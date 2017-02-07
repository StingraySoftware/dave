
var DOMAIN_URL = "http://localhost:5000"; //Set as Dave Server Ip:Port

var theToolPanel = null;
var theOutputPanel = null;
var theService = null;
var theFilename = "";
var theBckFilename = "";
var theBinSize = 100;

$(document).ready(function () {
  waitingDialog.show('Creating environment');

  Logger.show();
  log("App started!! ->" + DOMAIN_URL);

  theService = new Service (DOMAIN_URL);
  theService.subscribe_to_server_messages(onServerMessageReceived);

  theToolPanel = new ToolPanel (".toolPanel", theService, onSrcDatasetChanged, onBckDatasetChanged, onFiltersChanged);
  theOutputPanel = new OutputPanel (".outputPanelContainer", ".outputPanelToolBar", theService, onFiltersChangedFromPlot);
  $(window).resize(function () { theOutputPanel.resize(); });

  log("App Ready!! ->" + DOMAIN_URL);

  waitingDialog.hide();
});

function onSrcDatasetChanged ( filename ) {

  waitingDialog.show('Getting file schema: ' + filename);
  log("onSrcDatasetChanged:" + filename);

  theFilename = filename;

  theService.get_dataset_schema(filename, function( schema ) {
      log("onSrcDatasetChanged:" + schema);
      var jsonSchema = JSON.parse(schema);
      theToolPanel.onDatasetSchemaChanged(jsonSchema);
      refreshPlotsData(jsonSchema);
    },
    function( error ) {
        log("onSrcDatasetChanged error:" + JSON.stringify(error));
        waitingDialog.hide();
    });
}

function onBckDatasetChanged ( filename ) {

  waitingDialog.show('Getting file schema: ' + filename);
  log("onBckDatasetChanged:" + filename);

  theBckFilename = filename;

  theService.get_dataset_schema(filename, function( schema ) {
      log("onBckDatasetChanged:" + schema);

      if (theFilename != "") {
        refreshPlotsData(JSON.parse(schema))
      } else {
        waitingDialog.hide();
      }
    },
    function( error ) {
        log("onBckDatasetChanged error:" + JSON.stringify(error));
        waitingDialog.hide();
    });
}

function refreshPlotsData(schema) {
  theOutputPanel.onDatasetChanged(theFilename, theBckFilename, schema);
  theOutputPanel.onDatasetValuesChanged(theFilename, []);
}

function onFiltersChanged (filename, filters) {
  log("onFiltersChanged:" + filename + ", filters: " + filters);
  theOutputPanel.onDatasetValuesChanged(filename, filters);
}

function onFiltersChangedFromPlot (filters) {
  log("onFiltersChangedFromPlot: filters: " + JSON.stringify(filters));
  theToolPanel.applyFilters(filters);
}

function onServerMessageReceived (msg) {
  log("SERVER -> " + msg);
}
