
var DOMAIN_URL = "http://localhost:5000";

var theToolPanel = null;
var theOutputPanel = null;
var theService = null;
var filename = "";

$(document).ready(function () {

  Logger.show();
  log("App started!! ->" + DOMAIN_URL);

  theService = new Service (DOMAIN_URL);
  theToolPanel = new ToolPanel (".toolPanel", theService);
  theOutputPanel = new OutputPanel (".outputPanelContainer", theService);

  log("App Ready!! ->" + DOMAIN_URL);

});

function onDatasetChanged ( filename ) {
  log("onDatasetChanged:" + filename);

  theOutputPanel.onDatasetChanged(filename);

  theService.get_dataset_schema(filename, function( schema ) {

    log("onDatasetChanged:" + schema);
    var jsonSchema = JSON.parse(schema);
    theToolPanel.onDatasetSchemaChanged(jsonSchema);
    theOutputPanel.onDatasetValuesChanged(filename, [ { table:"txt_table", column:"Time", from: 0, to: 1000 } ]);

  });

}
