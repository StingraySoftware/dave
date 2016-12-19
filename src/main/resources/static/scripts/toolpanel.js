
$(document).ready(function () {

    $("#uploadFile").value = filename;

    $(document).on('change','input[type="file"]', function () {
      var fullfilename=this.value;
      var newFilename = fullfilename.replace(/^.*[\\\/]/, '');
      $("#uploadFile").value = newFilename;
    });

    $("#clear").bind("click", function() {
        toolPanel_Clear();
    });

    $("#btnSave1").click(function() {
        toolPanel_saveAsPNG($("#section1"));
    });

    $("#btnSave2").click(function() {
        toolPanel_saveAsPNG($("#section2"));
    });

});

function toolPanel_Clear(){

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

function toolPanel_saveAsPNG (section) {

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
