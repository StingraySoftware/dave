$(document).ready(function () {

  $(".btnHidePlot").bind("click", function(event){
      $("#" + event.target.id).parent().parent().hide();
   });

  $(window).resize(function() {

     var plots = $(".plotContainer");

     //Sets plots height
     plots.height($(window).height() * 0.5);

     var update = {
       width:plots.width(),
       height:plots.height()-20
     };

     plots.each(function () {
       try {
         var plot = $(this).find("*").toArray();
         Plotly.relayout(plot[2].getAttribute("id"), update);
       } catch (ex) {
         log("Resize plot error: " + ex);
       }
     });

   }).trigger("resize");

});
