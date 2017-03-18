
function Plot(id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable) {

  var currentObj = this;

  this.id = id.replace(/\./g,'');
  this.plotId = "plot_" + this.id;
  this.plotConfig = plotConfig;
  this.getDataFromServerFn = getDataFromServerFn;
  this.onFiltersChanged = onFiltersChangedFn;
  this.onPlotReady = onPlotReadyFn;
  this.isVisible = true;
  this.isReady = true;
  this.isSwitched = false;
  this.cssClass = (cssClass != undefined) ? cssClass : "";
  this.switchable = (switchable != undefined) ? switchable : false;
  this.data = null;

  this.$html = $('<div id="' + this.id + '" class="plotContainer ' + this.cssClass + '">' +
                  '<div id="' + this.plotId + '" class="plot"></div>' +
                  '<div class="plotTools">' +
                    '<div class="hoverinfo"></div>' +
                    '<button class="btn btn-default btnHidePlot"><i class="fa fa-eye-slash" aria-hidden="true"></i></button>' +
                    '<button class="btn btn-default btnSave"><i class="fa fa-floppy-o" aria-hidden="true"></i></button>' +
                  '</div>' +
                '</div>');

 this.btnShow = $('<button class="btn btn-default btnShow' + this.id + '"><i class="fa fa-eye" aria-hidden="true"></i></button>');
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
    currentObj.btnShow.html('<i class="fa fa-eye" aria-hidden="true"></i> ' + currentObj.plotConfig.styles.title);
    currentObj.btnShow.show();
 });

 this.btnSave.click(function( event ) {
    currentObj.saveAsPNG();
 });

 if (switchable) {
   //If switchable adds Switch button to plot
   this.btnSwitch = $('<button class="btn btn-default btnSwitch"><i class="fa fa-retweet" aria-hidden="true"></i></button>');
   this.$html.find(".plotTools").append(this.btnSwitch);
   this.btnSwitch.click(function(event){
      currentObj.isSwitched = !currentObj.isSwitched;
      currentObj.refreshData();
   });
 }

 if (!isNull(this.plotConfig.styles.selectable) && this.plotConfig.styles.selectable) {
   //If plot is lightcurve adds Select button to plot
   this.btnSelect = $('<button class="btn btn-default btnSelect"><i class="fa fa-thumb-tack" aria-hidden="true"></i></button>');
   this.$html.find(".plotTools").append(this.btnSelect);
   this.btnSelect.click(function(event){
     currentObj.$html.toggleClass("plotSelected");
     OnPlotSelected();
   });
 }

 this.onDatasetValuesChanged = function ( filters ) {
    this.applyValidFilters(filters);

    if (this.isVisible) {
       this.refreshData();
    }
 };

 this.refreshData = function () {
   this.setReadyState(false);

   if (isNull(this.getDataFromServerFn)) {
      log("Avoid request data, no service function setted, Plot" + currentObj.id);
      return;
   }

   var tab = getTabForSelector(this.id);
   this.plotConfig.dt = tab.projectConfig.binSize;

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
   } else {
     currentObj.setData(data);
   }
 }

 this.setData = function ( data ) {

   if (isNull(data)) {
     log("setData wrong passed data!, plot" + currentObj.id);
     return;
   }

   currentObj.data = data;

   var coords = { x: 0, y: 1};
   if (currentObj.isSwitched){
     coords = { x: 1, y: 0};
   }

   if (currentObj.plotConfig.styles.type == "2d") {
      plotlyConfig = get_plotdiv_xy(data[coords.x].values, data[coords.y].values,
                                    data[coords.x].error_values, data[coords.y].error_values,
                                    currentObj.getWtiRanges(data),
                                    currentObj.plotConfig.styles.labels[coords.x],
                                    currentObj.plotConfig.styles.labels[coords.y],
                                    currentObj.plotConfig.styles.title)

   } else if (currentObj.plotConfig.styles.type == "3d") {
      plotlyConfig = get_plotdiv_xyz(data[coords.x].values, data[coords.y].values, data[2].values,
                                    data[coords.x].error_values, data[coords.y].error_values, data[2].error_values,
                                    currentObj.plotConfig.styles.labels[coords.x],
                                    currentObj.plotConfig.styles.labels[coords.y],
                                    data[3].values);

   } else if (currentObj.plotConfig.styles.type == "scatter") {
      plotlyConfig = get_plotdiv_scatter(data[coords.x].values, data[coords.y].values,
                                        currentObj.plotConfig.styles.labels[coords.x],
                                        currentObj.plotConfig.styles.labels[coords.y],
                                        currentObj.plotConfig.styles.title);

   } else if (currentObj.plotConfig.styles.type == "scatter_colored") {
      plotlyConfig = get_plotdiv_scatter_colored(data[coords.x].values, data[coords.y].values,
                                        data[2].values,
                                        currentObj.plotConfig.styles.labels[coords.x],
                                        currentObj.plotConfig.styles.labels[coords.y],
                                        'Amplitude<br>Map',
                                        currentObj.plotConfig.styles.title);

   } else if (currentObj.plotConfig.styles.type == "ligthcurve") {
      plotlyConfig = get_plotdiv_lightcurve(data[0].values, data[1].values,
                                          [], [], currentObj.getWtiRanges(data),
                                          currentObj.plotConfig.styles.labels[coords.x],
                                          currentObj.plotConfig.styles.labels[coords.y],
                                          currentObj.plotConfig.styles.title);

   } else if (currentObj.plotConfig.styles.type == "colors_ligthcurve") {
      plotlyConfig = get_plotdiv_xyy(data[coords.x].values, data[coords.y].values, data[2].values,
                                   [], [], [], currentObj.getWtiRanges(data),
                                   currentObj.plotConfig.styles.labels[coords.x],
                                   currentObj.plotConfig.styles.labels[coords.y],
                                   currentObj.plotConfig.styles.labels[2],
                                   currentObj.plotConfig.styles.title);
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

 this.applyValidFilters = function (filters) {
   if (!isNull(this.plotConfig.mandatoryFilters)) {

     //Sets only valid filters: Valid filters is a filter without source, or
     //filter specified on mandatoryFilters
     validFilters = [];
     for (f in filters) {
       var filter = filters[f];
       if (filter != null) {
         if (!isNull(filter.source)) {
           for (mf in this.plotConfig.mandatoryFilters) {
             var mfilter = this.plotConfig.mandatoryFilters[mf];
             if (filter.source == mfilter.source
                  && filter.table == mfilter.table
                  && filter.column == mfilter.column) {
                    validFilters.push(filter);
                  }
           }
         } else if (isNull(filter.source)) {
           validFilters.push(filter);
         }
       }
     }

     this.plotConfig.filters = validFilters;
   } else {
     this.plotConfig.filters = filters;
   }
 }

 this.getWtiRanges = function (data) {

   //Prepares Wrong Time Intervals for background highlight

   if (data[0].values.length == 0) {
      return [];
   }

   var wti_x_ranges = [];
   var last_x = data[0].values[data[0].values.length - 1];
   var x = data[0].values[0];
   var totalElapsed = last_x - x;
   var prevX = x - 1;
   var prevY = 0;
   var prevPrevX = x - 2;
   var trigger_ratio = 10;  // The ratio of elapsed time versus prev elapsed for triggering a gap
   var elapsed_avg = 0;

   for (i in data[0].values) {

       x = data[0].values[i];
       y = data[1].values[i];
       var elapsed = x - prevX;

       if (y > 0){
         if (elapsed_avg > 0) {
           var ratio = elapsed / elapsed_avg;

           if (prevX > prevPrevX && prevPrevX > 0 && elapsed_avg != 1) {
             if (ratio > trigger_ratio) {
               //Looks that we are outside a GTI
               //Sets range start to end, x is the end index of the gti
               var wtiStart = prevX + (prevX - prevPrevX)/2;
               var wtiStop = x - (prevX - prevPrevX)/2;
               if (totalElapsed / (wtiStop - wtiStart) < trigger_ratio) {
                 // If WTI is at least the tenth part of total time
                 wti_x_ranges.push([wtiStart, wtiStop]);
               }
             }
           }

           // Calulates the ne elapsed_avg with the latest 5 vals, avoid break avg with gaps
           if (ratio < trigger_ratio || elapsed_avg == 1) {
             elapsed_avg += (elapsed - elapsed_avg) * 0.2;
           }

         } else {
           elapsed_avg = elapsed;
         }

         prevPrevX = prevX;
         prevX = x;
       }

       prevY = y;
   }

   return wti_x_ranges;
 }

 log ("new plot id: " + this.id);

 return this;
}

//Static plot METHODS
function OnPlotSelected () {

  var $selectedPlots = $(".plotSelected");
  if ($selectedPlots.length > 1){

    log("OnPlotSelected: Multiple plots selected!");
    var selectedPlots = [];

    //For each plot element find its plot object in all tabs outputpanels
    $selectedPlots.each(function(){
      var tab = getTabForSelector(this.id);
      if (tab != null) {
        var plot = tab.outputPanel.getPlotById(this.id);
        if (plot != null) {
          log("OnPlotSelected: Got plot id: " + this.id);
          selectedPlots.push(plot);
        }
      }
    })

    if (selectedPlots.length > 1) {
      onMultiplePlotsSelected(selectedPlots); // master_page.js method
    }
  }
}

function ClearSelectedPlots () {
  $(".plotSelected").removeClass("plotSelected");
}
