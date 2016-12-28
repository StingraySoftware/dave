
function Plot(id, plotConfig, service) {

  var currentObj = this;
  this.id = id;
  this.plotConfig = plotConfig;
  this.service = service;

  this.$html = $('<div class="plotContainer ' + this.id + '">' +
                  '<div style="float:right">' +
                  ' <button class="btnHidePlot">Hide</button>' +
                  '</div>' +
                  '<div>' +
                  ' <div class="hoverinfo" style="text-align:center;color:#1F77B4"></div>' +
                  '</div>' +
                '</div>');

 this.btnHide = this.$html.find(".btnHidePlot");

 this.btnHide.bind("click", function(event){
    currentObj.$html.hide();
 });

 this.onDatasetValuesChanged = function ( filename, filters ) {
   if (currentObj.plotConfig.filename == filename) {
     currentObj.plotConfig.filters = filters
     currentObj.service.request_plot( currentObj.plotConfig, currentObj.onPlotReceived );
   }
 };

 this.onPlotReceived = function ( plot_html ) {
   currentObj.$html.prepend(plot_html);
   currentObj.resize();
   log("onPlotReceived plot " + currentObj.id);
 }

 this.resize = function ( ) {
   try {

     var update = {
       width: currentObj.$html.width(),
       height: currentObj.$html.height()
     };

     Plotly.relayout(currentObj.$html.find("div")[1].getAttribute("id"), update);

   } catch (ex) {
     log("Resize plot " + currentObj.id + " error: " + ex);
   }
 }

 log ("new plot id: " + this.id);

 return this;
}
