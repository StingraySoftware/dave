
var DOMAIN_URL = "http://localhost:5000"; //Set as Dave Server Ip:Port

var theToolPanel = null;
var theOutputPanel = null;
var theService = null;
var theFilename = "";
var theFilenames = [];
var theSchema = null;
var theBckFilename = "";
var theBckFilenames = [];
var theGtiFilename = "";
var theGtiFilenames = [];
var theBinSize = 100;
var MIN_PLOT_POINTS = 2;
var MAX_PLOT_POINTS = 10000;
var theTimeUnit = "s";

$(document).ready(function () {
  waitingDialog.show('Creating environment');

  Logger.show();
  log("App started!! ->" + DOMAIN_URL);

  theService = new Service (DOMAIN_URL);
  theService.subscribe_to_server_messages(onServerMessageReceived);

  var wfSelector = $(".wfSelectorContainer");
  prepareButton(wfSelector.find(".loadBtn"), "loadPanel");
  prepareButton(wfSelector.find(".filterBtn"), "filterPanel");
  prepareButton(wfSelector.find(".analyzeBtn"), "analyzePanel");
  prepareButton(wfSelector.find(".styleBtn"), "stylePanel");

  theToolPanel = new ToolPanel (".toolPanel", theService, onSrcDatasetChanged, onBckDatasetChanged, onGtiDatasetChanged, onFiltersChanged);
  theOutputPanel = new OutputPanel (".outputPanelContainer", ".outputPanelToolBar", theService, onFiltersChangedFromPlot);
  $(window).resize(function () { theOutputPanel.resize(); });

  setCurrentPanel("loadPanel");
  wfSelector.find(".loadBtn").parent().addClass('active');

  log("App Ready!! ->" + DOMAIN_URL);

  waitingDialog.hide();
});

function prepareButton ( buttonElem, panel ) {
  buttonElem.button().bind("click", function( event ) {
    $(".wfSelectorContainer").find("li").removeClass('active');
    setCurrentPanel(panel);
  });
}

function setCurrentPanel ( panel ) {
  theToolPanel.showPanel(panel);
}

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

    theSchema = jsonSchema;

    // Sets the time unit
    if (!isNull(theSchema["EVENTS"])
        && !isNull(theSchema["EVENTS"]["HEADER"])
        && !isNull(theSchema["EVENTS"]["HEADER"]["TUNIT1"])) {
      theTimeUnit = theSchema["EVENTS"]["HEADER"]["TUNIT1"];
    }

    theToolPanel.onDatasetSchemaChanged(theSchema);
    refreshPlotsData(theSchema);
  } else {
    log("onSchemaChanged error:" + schema);
    waitingDialog.hide();
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
    if (theSchema != null) {
      refreshPlotsData(theSchema);
    } else {
      waitingDialog.hide();
    }
  } else {
    log("onBckSchemaChanged error:" + schema);
    waitingDialog.hide();
  }
}

function onGtiSchemaChanged( schema, params ) {
  log("onGtiSchemaChanged:" + schema);

  if (params !== undefined && params != null){
    theGtiFilenames = params.filenames;
    theGtiFilename = params.filename;
  }

  var jsonSchema = JSON.parse(schema);
  if (isNull(jsonSchema.error)){
    if (theSchema != null) {
      refreshPlotsData(theSchema);
    } else {
      waitingDialog.hide();
    }
  } else {
    log("onGtiSchemaChanged error:" + schema);
    waitingDialog.hide();
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

function onGtiDatasetChanged ( filenames ) {

  if (filenames.length == 1) {

    theGtiFilename = filenames[0];
    waitingDialog.show('Getting file schema: ' + theGtiFilename);
    log("onGtiDatasetChanged:" + theGtiFilename);
    theService.get_dataset_schema(theGtiFilename, onGtiSchemaChanged);

  } else if (filenames.length > 1){

    theGtiFilenames = filenames;
    theGtiFilename = filenames[0];
    var params = { filename: theGtiFilename, filenames: theGtiFilenames, currentFile: 1, onSchemaChanged:onGtiSchemaChanged };
    onSchemaChangedMultipleFiles(null, params);

  } else {
    log("onGtiDatasetChanged: No selected files..");
  }

}

function refreshPlotsData(schema) {
  theOutputPanel.onDatasetChanged(theFilename, theBckFilename, theGtiFilename, schema);
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
