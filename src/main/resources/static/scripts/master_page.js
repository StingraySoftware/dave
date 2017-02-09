
var DOMAIN_URL = "http://localhost:5000"; //Set as Dave Server Ip:Port

var theToolPanel = null;
var theOutputPanel = null;
var theService = null;
var theFilename = "";

var theFilenames = [];
var currentFile = -1;

var theBckFilename = "";
var theBinSize = 100;
var MIN_PLOT_POINTS = 2;
var MAX_PLOT_POINTS = 10000;

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

function onSrcDatasetChanged ( filenames ) {

  if (filenames.length == 1) {

    var filename = filenames[0];
    waitingDialog.show('Getting file schema: ' + filename);
    log("onSrcDatasetChanged:" + filename);

    theFilename = filename;
    theService.get_dataset_schema(filename, onSchemaChanged, onSchemaError);

  } else if (filenames.length > 1){

    theFilenames = filenames;
    var filename = filenames[0];
    theFilename = filename;
    currentFile = 1;

    onSchemaChangedMultipleFiles(null);
  }

}

function onSchemaChanged( schema ) {
  log("onSchemaChanged:" + schema);
  var jsonSchema = JSON.parse(schema);
  theToolPanel.onDatasetSchemaChanged(jsonSchema);
  refreshPlotsData(jsonSchema);
}

function onSchemaChangedMultipleFiles( result ) {

  if (result != null) {
    theFilename = JSON.parse(result);
    if (theFilename == ""){
      log("onSchemaChangedMultipleFiles: server returned false!");
      waitingDialog.hide();
      return;
    }
  }

  log("onSchemaChangedMultipleFiles: " + currentFile + "  -  " + theFilename);

  if (currentFile < theFilenames.length){

    var filename = theFilenames[currentFile];
    waitingDialog.show('Appending to dataset: ' + filename);
    theService.append_file_to_dataset(theFilename, filename, onSchemaChangedMultipleFiles, onSchemaError);
    currentFile ++;

  } else {

    waitingDialog.show('Getting file schema: ' + theFilename);
    theService.get_dataset_schema(theFilename, onSchemaChanged, onSchemaError);
  }

}

function onSchemaError ( error ) {
    log("onSchemaError error:" + JSON.stringify(error));
    waitingDialog.hide();
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
