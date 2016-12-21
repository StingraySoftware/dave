
$(document).ready(function () {

    var theToolPanel = $(".toolPanel");

    //Sets correct POST method to Flask, just temporary
    theToolPanel.parent().attr("action", DOMAIN_URL + "/upload");
    //Temporary, jut while using POST method

    var theFileSelector = new fileSelector("theFileSelector", filename);
    theToolPanel.append(theFileSelector.$html);

    var theTimeSelector = new sliderSelector("time", "Select Time Range", "From", "To", start_time_slider, end_time_slider);
    theToolPanel.append(theTimeSelector.$html);

    var theCountRateSelector = new sliderSelector("count", "Select Count Rate Range", "From", "To", start_count_slider, end_count_slider);
    theToolPanel.append(theCountRateSelector.$html);

    var theColor1Selector = new sliderSelector("color1", "Select Color1 Range", "From", "To", start_color1_slider, end_color1_slider);
    theToolPanel.append(theColor1Selector.$html);

    var theColor2Selector = new sliderSelector("color2", "Select Color2 Range", "From", "To", start_color2_slider, end_color2_slider);
    theToolPanel.append(theColor2Selector.$html);

    theToolPanel.find("#clear").bind("click", function() {
        toolPanel_Clear();
    });

    theToolPanel.find("#btnSave1").click(function() {
        toolPanel_saveAsPNG($("#section1"));
    });

    theToolPanel.find("#btnSave2").click(function() {
        toolPanel_saveAsPNG($("#section2"));
    });

    log("ToolPanel ready!");
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
