
function Plot(id, plotConfig, service, onFiltersChangedFn, toolbar) {

  var currentObj = this;
  this.id = id;
  this.plotConfig = plotConfig;
  this.service = service;
  this.onFiltersChanged = onFiltersChangedFn;
  this.isVisible = true;

  this.$html = $('<div class="plotContainer ' + this.id + '">' +
                  '<div style="float:right">' +
                  ' <div class="hoverinfo"></div>' +
                  ' <button class="btnHidePlot">Hide</button>' +
                  ' <button class="btnSave">Save</button>' +
                  '</div>' +
                '</div>');

 this.btnShow = $('<button class="btnShow' + this.id + '">Show</button>');
 this.btnShow.hide();
 toolbar.append(this.btnShow);

 this.btnHide = this.$html.find(".btnHidePlot");
 this.btnSave = this.$html.find(".btnSave");
 this.$plot = null;

 this.btnShow.click(function(event){
    currentObj.isVisible = true;
    currentObj.$html.show();
    currentObj.btnShow.hide();
    currentObj.refreshData();
 });

 this.btnHide.click(function(event){
    currentObj.isVisible = false;
    currentObj.$html.hide();
    currentObj.btnShow.show();
 });

 this.btnSave.click(function( event ) {
     currentObj.saveAsPNG();
 });

 this.onDatasetValuesChanged = function ( filename, filters ) {
   if (currentObj.plotConfig.filename == filename) {
     currentObj.plotConfig.filters = filters
     if (currentObj.isVisible) {
       currentObj.refreshData();
     }
   }
 };

 this.refreshData = function () {
   currentObj.service.request_plot( currentObj.plotConfig, currentObj.onPlotReceived );
 }

 this.onPlotReceived = function ( plot_html ) {
   currentObj.clear();

   currentObj.$html.prepend(plot_html);
   currentObj.$plot = currentObj.$html.find("div")[1];
   currentObj.registerPlotEvents()
   currentObj.resize();
   log("onPlotReceived plot " + currentObj.id);
 }

 this.clear = function (){
   if (this.$plot){
     $(this.$plot).remove();
   }
 }

 this.resize = function () {
   try {

     var update = {
       width: currentObj.$html.width(),
       height: currentObj.$html.height()
     };

     Plotly.relayout(currentObj.$plot.getAttribute("id"), update);

   } catch (ex) {
     log("Resize plot " + currentObj.id + " error: " + ex);
   }
 }

 this.registerPlotEvents = function () {

   if(this.plotConfig.styles.type == "2d") {

     this.$plot.on('plotly_selected', (eventData) => {

       if (eventData) {
         var xRange = eventData.range.x;
         var yRange = eventData.range.y;
         var xFilter = $.extend({ from: xRange[0], to: xRange[1] },
                                  this.plotConfig.axis[0]);
         var yFilter = $.extend({ from: yRange[0], to: yRange[1] },
                                  this.plotConfig.axis[1]);
         currentObj.onFiltersChanged ( [ xFilter, yFilter ]);
      }

     });

     this.$plot.on('plotly_hover', function(data){
          var infotextforx = data.points.map(function(d){
            return ('x : '+d.x);
          });

          var infotextfory = data.points.map(function(d){
            return ('y : '+d.y.toPrecision(6));
          });

          var pt = data.points[0];
          var ptNumber = pt.pointNumber;
          var trace = pt.data;

          error_x_string= (trace.error_x.array[ptNumber]).toString();
          error_y_string= (trace.error_y.array[ptNumber]).toString();

          var spacesup= '\xa0\xa0\xa0\xa0\xa0\xa0\xa0' ;
          var spacesdown= '\xa0\xa0\xa0\xa0\xa0\xa0\xa0' ;

          currentObj.$html.find(".hoverinfo").html(infotextforx +"+/-"  + error_x_string + spacesup + infotextfory + "+/-" + error_y_string);

     }).on('plotly_unhover', function(data){
         currentObj.$html.find(".hoverinfo").html("");
     });
   }

   this.saveAsPNG = function () {

     html2canvas(this.$plot, {
         onrendered: function(canvas) {
             theCanvas = canvas;
             // Convert and download as image
             Canvas2Image.saveAsPNG(canvas);
             // Clean up
             //document.body.removeChild(canvas);
         }
     });
   }

 }

 log ("new plot id: " + this.id);

 return this;
}
