
var DOMAIN_URL = "http://localhost:5000"; //Set as Dave Server Ip:Port

var theToolPanel = null;
var theOutputPanel = null;
var theService = null;
var theFilename = "";

$(document).ready(function () {

  Logger.show();
  log("App started!! ->" + DOMAIN_URL);

  theService = new Service (DOMAIN_URL);
  theToolPanel = new ToolPanel (".toolPanel", theService, onDatasetChanged, onFiltersChanged);
  theOutputPanel = new OutputPanel (".outputPanelContainer", ".outputPanelToolBar", theService, onFiltersChangedFromPlot);
  $(window).resize(function () { theOutputPanel.resize(); });

  log("App Ready!! ->" + DOMAIN_URL);

});

function onDatasetChanged ( filename ) {
  log("onDatasetChanged:" + filename);
  theFilename = filename;

  theOutputPanel.onDatasetChanged(filename);

  theService.get_dataset_schema(filename, function( schema ) {
      log("onDatasetChanged:" + schema);
      var jsonSchema = JSON.parse(schema);
      theToolPanel.onDatasetSchemaChanged(jsonSchema);
      theOutputPanel.onDatasetValuesChanged(filename, []);
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
