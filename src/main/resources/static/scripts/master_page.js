
var DOMAIN_URL = "http://localhost:5000";

var theToolPanel = null;
var filename = "";

$(document).ready(function () {

  Logger.show();
  log("App started!! ->" + DOMAIN_URL);

  theToolPanel = new ToolPanel (".toolPanel");

  log("App Ready!! ->" + DOMAIN_URL);

});

function onDatasetChanged ( filename ){
  log("onDatasetChanged:" + filename);

  $.get( DOMAIN_URL + "/get_dataset_schema", { filename: filename } )
  .done(function( schema ) {

    log("onDatasetChanged:" + schema);
    theToolPanel.onDatasetSchemaChanged(JSON.parse(schema));

  });

}
