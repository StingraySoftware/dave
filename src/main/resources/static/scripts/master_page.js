
var DOMAIN_URL = "http://localhost:5000"; //Set as Dave Server Ip:Port

var theToolPanel = null;
var theOutputPanel = null;
var theService = null;
var theFilename = "";
var theFilenames = [];
var theBckFilename = "";
var theBckFilenames = [];
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

    theFilename = filenames[0];
    waitingDialog.show('Getting file schema: ' + theFilename);
    log("onSrcDatasetChanged:" + theFilename);
    theService.get_dataset_schema(theFilename, onSchemaChanged, onSchemaError, params);

  } else if (filenames.length > 1){

    theFilenames = filenames;
    theFilename = filenames[0];
    var params = { filename: theFilename, filenames: theFilenames, currentFile: 1, onSchemaChanged:onSchemaChanged };
    onSchemaChangedMultipleFiles(null, params);

  } else {
    log("onSrcDatasetChanged: No selected files..");
  }

}

function onSchemaChanged( schema, params ) {
  log("onSchemaChanged:" + schema);

  if (params !== undefined && params != null){
    theFilenames = params.filenames;
    theFilename = params.filename;
  }

  var jsonSchema = JSON.parse(schema);
  if (isNull(jsonSchema.error)){
    theToolPanel.onDatasetSchemaChanged(jsonSchema);
    refreshPlotsData(jsonSchema);
  } else {
    log("onSchemaChanged error:" + schema);
  }
}

function onBckSchemaChanged( schema, params ) {
  log("onBckDatasetChanged:" + schema);

  if (params !== undefined && params != null){
    theBckFilenames = params.filenames;
    theBckFilename = params.filename;
  }

  var jsonSchema = JSON.parse(schema);
  if (isNull(jsonSchema.error)){
    if (theFilename != "") {
      refreshPlotsData(jsonSchema)
    } else {
      waitingDialog.hide();
    }
  } else {
    log("onBckSchemaChanged error:" + schema);
  }
}

function onSchemaChangedMultipleFiles( result, params ) {

  if (result != null) {
    params.filename = JSON.parse(result);
    if (params.filename == ""){
      log("onSchemaChangedMultipleFiles: server returned false!");
      waitingDialog.hide();
      return;
    }
  }

  log("onSchemaChangedMultipleFiles: " + params.currentFile + "  -  " + params.filename);

  if (params.currentFile < params.filenames.length){

    var filename = params.filenames[params.currentFile];
    waitingDialog.show('Appending to dataset: ' + filename);
    theService.append_file_to_dataset(params.filename, filename, onSchemaChangedMultipleFiles, onSchemaError, params);
    params.currentFile++;

  } else {

    waitingDialog.show('Getting file schema: ' + theFilename);
    theService.get_dataset_schema(params.filename, params.onSchemaChanged, onSchemaError);
  }

}

function onSchemaError ( error ) {
    log("onSchemaError error:" + JSON.stringify(error));
    waitingDialog.hide();
}

function onBckDatasetChanged ( filenames ) {

  if (filenames.length == 1) {

    theBckFilename = filenames[0];
    waitingDialog.show('Getting file schema: ' + theBckFilename);
    log("onBckDatasetChanged:" + theBckFilename);
    theService.get_dataset_schema(theBckFilename, onBckSchemaChanged);

  } else if (filenames.length > 1){

    theBckFilenames = filenames;
    theBckFilename = filenames[0];
    var params = { filename: theBckFilename, filenames: theBckFilenames, currentFile: 1, onSchemaChanged:onBckSchemaChanged };
    onSchemaChangedMultipleFiles(null, params);

  } else {
    log("onBckDatasetChanged: No selected files..");
  }

}

function refreshPlotsData(schema) {
  theOutputPanel.onDatasetChanged(theFilename, theBckFilename, schema);
  theOutputPanel.onDatasetValuesChanged(theFilename, theToolPanel.getFilters());
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

function isNull (value) {
  return (value === undefined) || (value == null);
}
