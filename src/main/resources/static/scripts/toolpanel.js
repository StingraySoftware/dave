
function ToolPanel (classSelector) {

  var currentObj = this;

  this.classSelector = classSelector;
  this.$html = $(this.classSelector);

  var theFileSelector = new fileSelector("theFileSelector", filename);
  this.$html.append(theFileSelector.$html);

  this.$html.find(".button").button();

  this.$html.find(".btnClear").bind("click", function( event ) {
      event.preventDefault();
      currentObj.clear();
  });

  this.$html.find(".btnSave1").click(function( event ) {
      event.preventDefault();
      currentObj.saveAsPNG($("#section1"));
  });

  this.$html.find(".btnSave2").click(function( event ) {
      event.preventDefault();
      currentObj.saveAsPNG($("#section2"));
  });

  this.clear = function (){

       $("#section1").empty();
       $("#section2").empty();
       $("#section3").empty();
       $("#section4").empty();
       $( "#from_time" ).val("");
       $( "#to_time" ).val("");
       $( "#from_count" ).val("");
       $( "#to_count" ).val("");
       $( "#from_color1" ).val("");
       $( "#to_color1" ).val("");
       $( "#from_color2" ).val("");
       $( "#to_color2" ).val("");
  }

  this.saveAsPNG = function (section) {

    html2canvas(section, {
        onrendered: function(canvas) {
            theCanvas = canvas;
            // Convert and download as image
            Canvas2Image.saveAsPNG(canvas);
            // Clean up
            //document.body.removeChild(canvas);
        }
    });
  }

  this.onDatasetSchemaChanged = function ( schema ) {

    clear_sliderSelectors();

    for (tableName in schema) {
      var table = schema[tableName];

      for (columnName in table) {

        var column = table[columnName];
        var selector = new sliderSelector(columnName, columnName + ":", "From", "To", column.min_value, column.max_value);
        this.$html.append(selector.$html);

      }
    }

  }

  log("ToolPanel ready! classSelector: " + this.classSelector);
}
