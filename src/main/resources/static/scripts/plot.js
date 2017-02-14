
function Plot(id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass) {

  var currentObj = this;
  this.id = id;
  this.plotId = "plot_" + id;
  this.plotConfig = plotConfig;
  this.getDataFromServerFn = getDataFromServerFn;
  this.onFiltersChanged = onFiltersChangedFn;
  this.onPlotReady = onPlotReadyFn;
  this.isVisible = true;
  this.isReady = true;
  this.cssClass = (cssClass != undefined) ? cssClass : "";

  this.$html = $('<div class="plotContainer ' + this.id + ' ' + this.cssClass + '">' +
                  '<div id="' + this.plotId + '" class="plot"></div>' +
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
 this.plotElem = null;
 this.$hoverinfo = this.$html.find(".hoverinfo");

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
   if (this.plotConfig.filename == filename) {
     this.plotConfig.filters = filters
     if (this.isVisible) {
       this.refreshData();
     }
   }
 };

 this.refreshData = function () {
   this.setReadyState(false);

   if ((this.plotConfig.styles.type == "ligthcurve") ||
      (this.plotConfig.styles.type == "colors_ligthcurve")){
     this.plotConfig.dt = theBinSize;
   }

   this.getDataFromServerFn( this.plotConfig, this.onPlotDataReceived );
 }

 this.onPlotDataReceived = function ( data ) {

   var plotlyConfig = null;

   log("onPlotReceived passed data!, plot" + currentObj.id);
   data = JSON.parse(data);

   if (data == null) {
     log("onPlotReceived wrong data!, plot" + currentObj.id);
     currentObj.setReadyState(true);
     currentObj.onPlotReady();
     return;
   }

   if (currentObj.plotConfig.styles.type == "2d") {
      plotlyConfig = get_plotdiv_xy(data[0].values, data[1].values,
                                    data[0].error_values, data[1].error_values,
                                    currentObj.plotConfig.styles.labels[0],
                                    currentObj.plotConfig.styles.labels[1])

   } else if (currentObj.plotConfig.styles.type == "3d") {
      plotlyConfig = get_plotdiv_xyz(data[0].values, data[1].values, data[2].values,
                                    data[0].error_values, data[1].error_values, data[2].error_values,
                                    currentObj.plotConfig.styles.labels[0],
                                    currentObj.plotConfig.styles.labels[1],
                                    data[3].values);

   } else if (currentObj.plotConfig.styles.type == "scatter") {
      plotlyConfig = get_plotdiv_scatter(data[0].values, data[1].values,
                                        data[2].values,
                                        currentObj.plotConfig.styles.labels[0],
                                        currentObj.plotConfig.styles.labels[1],
                                        'Amplitude<br>Map');
   } else if (currentObj.plotConfig.styles.type == "ligthcurve") {
      plotlyConfig = get_plotdiv_xy(data[0].values, data[1].values,
                                   [], [],
                                   currentObj.plotConfig.styles.labels[0],
                                   currentObj.plotConfig.styles.labels[1]);
   } else if (currentObj.plotConfig.styles.type == "colors_ligthcurve") {
      plotlyConfig = get_plotdiv_xyy(data[0].values, data[1].values, data[2].values,
                                   [], [], [],
                                   currentObj.plotConfig.styles.labels[0],
                                   currentObj.plotConfig.styles.labels[1],
                                   currentObj.plotConfig.styles.labels[2]);
   }

   if (plotlyConfig != null) {
     Plotly.newPlot(currentObj.plotId, plotlyConfig.data, plotlyConfig.layout);
     currentObj.plotElem = currentObj.$html.find(".plot")[0];
     currentObj.registerPlotEvents()
     currentObj.resize();
     log("onPlotReceived plot " + currentObj.id);

   } else {

     log("onPlotReceived ERROR: WRONG PLOT CONFIG! plot " + currentObj.id);
   }

   currentObj.setReadyState(true);
   currentObj.onPlotReady();
 }

 this.setReadyState = function (isReady) {
   this.isReady = isReady;
   log("setReadyState plot " + this.id + " -> " + isReady);
 }

 this.resize = function () {
   try {
     if (this.plotElem != null) {
       var update = {
         width: $(this.plotElem).width(),
         height: $(this.plotElem).height()
       };

       Plotly.relayout(this.plotId, update);
     } else {
       log("Resize plot " + this.id + ", not ready yet. ");
     }
   } catch (ex) {
     log("Resize plot " + this.id + " error: " + ex);
   }
 }

 this.registerPlotEvents = function () {

   if((this.plotConfig.styles.type == "2d")
      || (this.plotConfig.styles.type == "ligthcurve")
      || (this.plotConfig.styles.type == "colors_ligthcurve")) {

     this.plotElem.on('plotly_selected', (eventData) => {

       if (eventData){
         var xRange = eventData.range.x;
         var yRange = eventData.range.y;
         var filters = [];

         //If plot data for label[0] is the same as axis[0] data,
         // else label data is calculated/derived with some process
         if (this.plotConfig.styles.labels[0].startsWith(this.plotConfig.axis[0].column)){
          filters.push($.extend({ from: Math.floor(xRange[0]), to: Math.ceil(xRange[1]) },
                                  this.plotConfig.axis[0]));
         }

         //Same here but for other axis
         if (this.plotConfig.styles.labels[1].startsWith(this.plotConfig.axis[1].column)){
            filters.push($.extend({ from: Math.floor(yRange[0]), to: Math.ceil(yRange[1]) },
                                  this.plotConfig.axis[1]));
         }

         if (filters.length > 0){
           currentObj.onFiltersChanged (filters);
         }
      }

     });

     this.plotElem.on('plotly_hover', function(data){
          var infotextforx = data.points.map(function(d){
            return ('x : '+d.x);
          });

          var infotextfory = data.points.map(function(d){
            return ('y : '+d.y.toPrecision(6));
          });

          var pt = data.points[0];
          var ptNumber = pt.pointNumber;
          var trace = pt.data;

          var error_x_string = "";
          var error_y_string = "";
          if (ptNumber < trace.error_x.array.length) {
            error_x_string= "+/-" + (trace.error_x.array[ptNumber]).toString();
            error_y_string= "+/-" + (trace.error_y.array[ptNumber]).toString();
          }

          var spacesup= '\xa0\xa0\xa0\xa0\xa0\xa0\xa0' ;
          var spacesdown= '\xa0\xa0\xa0\xa0\xa0\xa0\xa0' ;

          currentObj.$hoverinfo.html(infotextforx  + error_x_string + spacesup + infotextfory + error_y_string);

     }).on('plotly_unhover', function(data){
         currentObj.$hoverinfo.html("");
     });
   }

   this.saveAsPNG = function () {

     html2canvas(this.plotElem, {
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
