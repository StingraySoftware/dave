
var DOMAIN_URL = "http://localhost:5000";

var theToolPanel = null;
var theOutputPanel = null;
var filename = "";

$(document).ready(function () {

  Logger.show();
  log("App started!! ->" + DOMAIN_URL);

  theToolPanel = new ToolPanel (".toolPanel");
  theOutputPanel = new OutputPanel (".outputPanelContainer");

  log("App Ready!! ->" + DOMAIN_URL);

});

function onDatasetChanged ( filename ){
  log("onDatasetChanged:" + filename);

  $.get( DOMAIN_URL + "/get_dataset_schema", { filename: filename } )
  .done(function( schema ) {

    log("onDatasetChanged:" + schema);
    var jsonSchema = JSON.parse(schema);
    theToolPanel.onDatasetSchemaChanged(jsonSchema);
    theOutputPanel.onDatasetValuesChanged(filename, [ { table:"table_txt", column:"Time", from: 0, to: 1000 } ]);

  });

}
