
var DOMAIN_URL = "http://localhost:5000"; //Set as Dave Server Ip:Port

var theToolPanel = null;
var theOutputPanel = null;
var theService = null;
var theFilename = "";
var theBckFilename = "";

$(document).ready(function () {

  Logger.show();
  log("App started!! ->" + DOMAIN_URL);

  theService = new Service (DOMAIN_URL);
  theToolPanel = new ToolPanel (".toolPanel", theService, onSrcDatasetChanged, onBckDatasetChanged, onFiltersChanged);
  theOutputPanel = new OutputPanel (".outputPanelContainer", ".outputPanelToolBar", theService, onFiltersChangedFromPlot);
  $(window).resize(function () { theOutputPanel.resize(); });

  log("App Ready!! ->" + DOMAIN_URL);

});

function onSrcDatasetChanged ( filename ) {
  log("onSrcDatasetChanged:" + filename);
  theFilename = filename;

  theService.get_dataset_schema(filename, function( schema ) {
      log("onSrcDatasetChanged:" + schema);
      var jsonSchema = JSON.parse(schema);
      theToolPanel.onDatasetSchemaChanged(jsonSchema);
      theOutputPanel.onDatasetChanged(filename, theBckFilename, jsonSchema);
      theOutputPanel.onDatasetValuesChanged(filename, []);
    }, function( error ) {
        log("onSrcDatasetChanged error:" + JSON.stringify(error));
    });
}

function onBckDatasetChanged ( filename ) {
  log("onBckDatasetChanged:" + filename);
  theBckFilename = filename;

  theService.get_dataset_schema(filename, function( schema ) {
      log("onBckDatasetChanged:" + schema);

      if (theFilename != "") {
        var jsonSchema = JSON.parse(schema);
        theOutputPanel.onDatasetChanged(filename, theBckFilename, jsonSchema);
        theOutputPanel.onDatasetValuesChanged(filename, []);
      }

    }, function( error ) {
        log("onBckDatasetChanged error:" + JSON.stringify(error));
    });
}

function onFiltersChanged (filename, filters) {
  log("onFiltersChanged:" + filename + ", filters: " + filters);

  theOutputPanel.onDatasetValuesChanged(filename, filters);
}

function onFiltersChangedFromPlot (filters) {
  log("onFiltersChangedFromPlot: filters: " + JSON.stringify(filters));

  theToolPanel.applyFilters(filters);
}
