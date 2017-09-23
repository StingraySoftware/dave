
function Plot(id, plotConfig, getDataFromServerFn, onFiltersChangedFn, onPlotReadyFn, toolbar, cssClass, switchable) {

  var currentObj = this;

  this.id = id.replace(/\./g,'');
  this.plotId = "plot_" + this.id;
  this.plotConfig = plotConfig;
  this.getDataFromServerFn = getDataFromServerFn;
  this.onFiltersChanged = onFiltersChangedFn;
  this.onPlotReady = onPlotReadyFn;
  this.currentRequest = null;
  this.isLoading = true;
  this.isVisible = true;
  this.isReady = true;
  this.isSwitched = false;
  this.hoverDisablerEnabled = true;
  this.hoverEnabled = false;
  this.cssClass = (!isNull(cssClass)) ? cssClass : "";
  this.switchable = (!isNull(switchable)) ? switchable : false;
  this.data = null;
  this.extraData = null;
  this.tracesCount = 0;
  this.addedTraces = 0;
  this.minX = 0;
  this.minY = 0;
  this.maxX = 0;
  this.maxY = 0;

  this.$html = $('<div id="' + this.id + '" class="plotContainer ' + this.cssClass + '">' +
                  '<div class="loading">' +
                    '<div class="loadingGif"><img src="static/img/loading.gif"/></div>' +
                  '</div>' +
                  '<div class="hoverDisabler">' +
                  '</div>' +
                  '<div id="' + this.plotId + '" class="plot"></div>' +
                  '<div class="plotTools">' +
                    '<button class="btn btn-default btnHidePlot" data-toggle="tooltip" title="Hide plot"><i class="fa fa-eye-slash" aria-hidden="true"></i></button>' +
                    '<button class="btn btn-default btnFullScreen" data-toggle="tooltip" title="Maximize/Minimize">' +
                      '<i class="fa ' + ((this.cssClass.indexOf("full") > -1) ? 'fa-compress' : 'fa-arrows-alt') + '" aria-hidden="true"></i>' +
                    '</button>' +
                    '<button class="btn btn-default btnLoad" data-toggle="tooltip" title="Load external data"><i class="fa fa-folder-open-o" aria-hidden="true"></i></button>' +
                    '<button class="btn btn-default btnSave" data-toggle="tooltip" title="Save or Export"><i class="fa fa-floppy-o" aria-hidden="true"></i></button>' +
                  '</div>' +
                  '<div class="hoverinfo"></div>' +
                '</div>');

 if (!isNull(toolbar)) {
   this.btnShow = $('<button class="btn btn-default btnShow ' + this.id + '" data-toggle="tooltip" title="Show plot"><i class="fa fa-eye" aria-hidden="true"></i></button>');
   this.btnShow.click(function(event){
      if (currentObj.btnShow.hasClass("plotHidden")) {
        currentObj.show();
      } else {
        currentObj.hide();
      }
   });
   var btnShowText = "";
   if (!isNull(this.plotConfig.styles.title)) {
     btnShowText = this.plotConfig.styles.title;
   }
   this.btnShow.html('<i class="fa fa-eye" aria-hidden="true"></i> ' + btnShowText);
   toolbar.append(this.btnShow);

   this.btnHide = this.$html.find(".btnHidePlot");
   this.btnHide.click(function(event){
      currentObj.hide();
   });
 } else {
   this.$html.find(".btnHidePlot").remove();
 }

 this.btnFullScreen = this.$html.find(".btnFullScreen");
 this.btnLoad = this.$html.find(".btnLoad");
 this.btnSave = this.$html.find(".btnSave");
 this.plotElem = null;
 this.$hoverinfo = this.$html.find(".hoverinfo");

 this.show = function (){
   currentObj.isVisible = true;
   currentObj.$html.show();
   var tab = getTabForSelector(currentObj.id);
   if (!isNull(tab)){
     var btnShow = tab.$html.find(".sectionContainer").find("." + currentObj.id);
     btnShow.removeClass("plotHidden");
     btnShow.find("i").switchClass( "fa-eye-slash", "fa-eye");
   } else {
     log("ERROR on show: Plot not attached to tab, Plot: " + this.id);
   }
   currentObj.refreshData();
 }

 this.hide = function (){
   currentObj.isVisible = false;
   currentObj.$html.hide();
   var tab = getTabForSelector(currentObj.id);
   if (!isNull(tab)){
     var btnShow = tab.$html.find(".sectionContainer").find("." + currentObj.id);
     btnShow.addClass("plotHidden");
     btnShow.find("i").switchClass( "fa-eye", "fa-eye-slash");
   } else {
     log("ERROR on show: Plot not attached to tab, Plot: " + this.id);
   }
 }

 this.showLoading = function (){
   this.isLoading = true;
   this.$html.find(".loading").show();
 }

 this.hideLoading = function (){
   this.isLoading = false;
   this.$html.find(".loading").hide();
 }

 this.btnFullScreen.click(function( event ) {
   if (currentObj.$html.hasClass("fullWidth")) {
     currentObj.btnFullScreen.find("i").switchClass( "fa-compress", "fa-arrows-alt");
   } else {
     currentObj.btnFullScreen.find("i").switchClass( "fa-arrows-alt", "fa-compress");
   }
   currentObj.$html.toggleClass("fullWidth");
   currentObj.resize();
 });

 this.updateFullscreenBtn = function () {};
 this.updateFullscreenBtn();

 this.btnSave.click(function( event ) {
   var saveDialog = $('<div id="dialog_' + currentObj.id +  '" title="Save ' + currentObj.plotConfig.styles.title + '"></div>');
   saveDialog.dialog({
      buttons: {
        'Save as PNG': function() {
           currentObj.saveAsPNG();
           $(this).dialog('close');
           saveDialog.remove();
        },
        'Save as PDF': function() {
          currentObj.saveAsPDF();
           $(this).dialog('close');
           saveDialog.remove();
        },
        'Save as CSV': function() {
          currentObj.saveAsCSV();
           $(this).dialog('close');
           saveDialog.remove();
        }
      }
    });
    saveDialog.parent().find(".ui-dialog-titlebar-close").html('<i class="fa fa-times" aria-hidden="true"></i>');
    currentObj.$html.append(saveDialog);
 });

 this.btnLoad.click(function( event ) {
   var loadDialog = $('<div id="dialog_' + currentObj.id +  '" title="Load external data for ' + currentObj.plotConfig.styles.title + '"></div>');
   loadDialog.dialog({
      buttons: {
        'Load CSV File': function() {
           currentObj.loadCSVFile();
           $(this).dialog('close');
           loadDialog.remove();
        },
        'Cancel/Clear': function() {
           currentObj.extraData = null;
           currentObj.redrawDiffered();
           $(this).dialog('close');
           loadDialog.remove();
        }
      }
    });
    loadDialog.parent().find(".ui-dialog-titlebar-close").html('<i class="fa fa-times" aria-hidden="true"></i>');
    currentObj.$html.append(loadDialog);
 });

 if (switchable) {
   //If switchable adds Switch button to plot
   this.btnSwitch = $('<button class="btn btn-default btnSwitch" data-toggle="tooltip" title="Switch axes"><i class="fa fa-retweet" aria-hidden="true"></i></button>');
   this.$html.find(".plotTools").append(this.btnSwitch);
   this.btnSwitch.click(function(event){
      currentObj.isSwitched = !currentObj.isSwitched;
      currentObj.refreshData();
   });
 }

 if (!isNull(this.plotConfig.styles.selectable) && this.plotConfig.styles.selectable) {
   //If plot is lightcurve adds Select button to plot
   this.btnSelect = $('<button class="btn btn-default btnSelect" data-toggle="tooltip" title="Select plot"><i class="fa fa-thumb-tack" aria-hidden="true"></i></button>');
   this.$html.find(".plotTools").append(this.btnSelect);
   this.btnSelect.click(function(event){
     currentObj.$html.toggleClass("plotSelected");
     OnPlotSelected();
   });
 }

 this.isSelectable = function(){
   return !isNull(this.plotConfig.styles.selectable) && this.plotConfig.styles.selectable;
 }

 this.isBulkPlot = function(){
   return !isNull(this.plotConfig.styles.bulkPlot) && this.plotConfig.styles.bulkPlot;
 }

 this.onDatasetValuesChanged = function ( filters ) {

   if (!isNull(this.parentPlotId)) {
     var tab = getTabForSelector(this.id);
     var parentPlot = tab.outputPanel.getPlotById(this.parentPlotId);
     parentPlot.applyValidFilters(filters);
   }

   this.applyValidFilters(filters);

    if (this.isVisible) {
       this.refreshData();
    }
 };

 this.refreshData = function () {
   this.setReadyState(false);

   if (isNull(this.getDataFromServerFn)) {
     if (!isNull(this.parentPlotId)) {
       var tab = getTabForSelector(this.id);
       var parentPlot = tab.outputPanel.getPlotById(this.parentPlotId);
       if (!parentPlot.isVisible) {
          log("Force parent plot to refresh data, Plot: " + this.id+ " , ParentPlot: " + parentPlot.id);
          parentPlot.refreshData();
          return;
       } else if (parentPlot.isReady) {
          this.setReadyState(true);
       }
     }

     log("Avoid request data, no service function setted, Plot: " + this.id);
     return;
   } else {
     this.updatePlotConfig();

     if (!isNull(this.currentRequest) && !isNull(this.currentRequest.abort)) {
       this.currentRequest.abort();
     }

     this.currentRequest = this.getDataFromServerFn( this.plotConfig, this.onPlotDataReceived );
   }
 }

 this.updatePlotConfig = function () {
   var binSize = this.getBinSize();
   if (!isNull(binSize)){
     this.plotConfig.dt = binSize;
   } else {
     log("ERROR on updatePlotConfig: BinSize is null, Plot: " + this.id);
   }
 }

 this.getBinSize = function () {
   var tab = getTabForSelector(this.id);
   if (!isNull(tab)){
     return tab.projectConfig.binSize;
   } else if (!isNull(this.plotConfig.dt) && this.plotConfig.dt > 0){
     return this.plotConfig.dt;
   } else {
     logErr("ERROR on getBinSize: Plot not attached to tab and has no plotConfig.dt, Plot: " + this.id);
     return null;
   }
 }

 this.onPlotDataReceived = function ( data ) {

   if (!isNull(data.abort)){
     log("Current request aborted, Plot: " + currentObj.id);
     if (data.statusText == "error"){
       //If abort cause is because python server died
       currentObj.setReadyState(true);
       currentObj.showWarn("Connection lost!");
     }
     return; //Comes from request abort call.
   }

   log("onPlotDataReceived passed data!, plot" + currentObj.id);

   currentObj.currentRequest = null;
   data = JSON.parse(data);

   if (!isNull(data)) {
     if (isNull(data.error)) {
       currentObj.setData(data);
       return;
     } else {
       currentObj.showWarn(data.error);
       log("onPlotDataReceived data error: " + data.error + ", plot" + currentObj.id);
     }
   } else {
     currentObj.showWarn("Wrong data received");
     log("onPlotDataReceived wrong data!, plot" + currentObj.id);
   }

   currentObj.setReadyState(true);
   currentObj.onPlotReady();
 }

 this.setData = function ( data ) {

   currentObj.showWarn("");

   if (isNull(data)) {

     currentObj.showWarn("Wrong data received");
     log("setData wrong passed data!, plot" + currentObj.id);

   } else {

     currentObj.data = currentObj.prepareData(data);
     currentObj.updateMinMaxCoords();

     var plotlyConfig = currentObj.getPlotlyConfig(currentObj.data);
     currentObj.redrawPlot(plotlyConfig);

     if (currentObj.data.length == 0 || currentObj.data[0].values.length == 0){
       currentObj.showWarn("Empty plot data");
     }

   }

   currentObj.setReadyState(true);
   currentObj.onPlotReady();
 }

 this.prepareData = function (data) {
   return data; //This method is just for being overriden if necessary
 }

 this.getPlotlyConfig = function (data) {
   var coords = currentObj.getSwitchedCoords( { x: 0, y: 1} );
   var plotlyConfig = null;

   if (currentObj.plotConfig.styles.type == "2d") {
      plotlyConfig = get_plotdiv_xy(data[coords.x].values, data[coords.y].values,
                                    data[coords.x].error_values, data[coords.y].error_values,
                                    (data.length > 3) ? currentObj.getWtiRangesFromGtis(data[2].values, data[3].values, data[0].values) : [],
                                    currentObj.getLabel(coords.x),
                                    currentObj.getLabel(coords.y),
                                    currentObj.plotConfig.styles.title)

   } else if (currentObj.plotConfig.styles.type == "3d") {
      plotlyConfig = get_plotdiv_xyz(data[coords.x].values, data[coords.y].values, data[2].values,
                                    data[coords.x].error_values, data[coords.y].error_values, data[2].error_values,
                                    currentObj.getLabel(coords.x),
                                    currentObj.getLabel(coords.y),
                                    data[3].values);

   } else if (currentObj.plotConfig.styles.type == "scatter") {
      plotlyConfig = get_plotdiv_scatter(data[coords.x].values, data[coords.y].values,
                                        currentObj.getLabel(coords.x),
                                        currentObj.getLabel(coords.y),
                                        currentObj.plotConfig.styles.title);
   } else if (currentObj.plotConfig.styles.type == "scatter_with_errors") {
      plotlyConfig = get_plotdiv_scatter_with_errors(data[coords.x].values, data[coords.y].values,
                                                     data[coords.x].error_values, data[coords.y].error_values,
                                                     currentObj.getLabel(coords.x),
                                                     currentObj.getLabel(coords.y),
                                                     currentObj.plotConfig.styles.title);
   } else if (currentObj.plotConfig.styles.type == "scatter_colored") {
      plotlyConfig = get_plotdiv_scatter_colored(data[coords.x].values, data[coords.y].values, data[2].values,
                                        currentObj.getLabel(coords.x),
                                        currentObj.getLabel(coords.y),
                                        'Amplitude<br>Map',
                                        currentObj.plotConfig.styles.title);

   } else if (currentObj.plotConfig.styles.type == "colors_ligthcurve") {
      plotlyConfig = get_plotdiv_xyy(data[0].values, data[1].values, data[2].values,
                                   [], [], [],
                                   (data.length > 4) ? currentObj.getWtiRangesFromGtis(data[3].values, data[4].values, data[0].values) : [],
                                   currentObj.getLabel(coords.x),
                                   currentObj.getLabel(coords.y),
                                   currentObj.getLabel(2),
                                   currentObj.plotConfig.styles.title);
   }

   plotlyConfig = this.addExtraDataConfig(plotlyConfig);
   plotlyConfig = this.prepareAxis(plotlyConfig);

   return plotlyConfig;
 }

 this.prepareAxis = function (plotlyConfig) {
   if (currentObj.plotConfig.xAxisType == "log") {
     plotlyConfig.layout.xaxis.type = 'log';
     plotlyConfig.layout.xaxis.autorange = true;
   }

   if (currentObj.plotConfig.yAxisType == "log") {
     plotlyConfig.layout.yaxis.type = 'log';
     plotlyConfig.layout.yaxis.autorange = true;
   }

   return plotlyConfig;
 }

 this.addExtraDataConfig = function (plotlyConfig) {
   if (!isNull(this.extraData)
       && this.extraData.length > 1
       && plotlyConfig.data.length > 0){
     //If plot config has data, clones first trace and changes its axis data and color
     var extraTrace = $.extend(true, {}, plotlyConfig.data[0]);
     extraTrace.x = this.extraData[0];
     extraTrace.y = this.extraData[1];
     extraTrace.line = { color : EXTRA_DATA_COLOR };
     plotlyConfig.data.splice(0, 0, extraTrace);
   }
   return plotlyConfig;
 }

 this.redrawPlot = function (plotlyConfig) {
   try {
     if (plotlyConfig != null) {

       this.tracesCount = plotlyConfig.data.length;

       //Adds the crosshairs to the plot
       plotlyConfig.data.push(getCrossLine ([this.minX, this.minX], [this.minY, this.maxY]));
       plotlyConfig.data.push(getCrossLine ([this.minX, this.maxX], [this.minY, this.minY]));

       //Creates the plot
       Plotly.newPlot(this.plotId, plotlyConfig.data, plotlyConfig.layout);

       this.plotElem = this.$html.find(".plot")[0];

       this.registerPlotEvents()
       this.resize();

     } else {
       this.showWarn("Wrong plot config");
       log("setData ERROR: WRONG PLOT CONFIG! plot " + this.id);
     }
   } catch (e) {
     this.showWarn("Wrong plot config");
     log("setData ERROR: WRONG PLOT CONFIG! plot " + this.id + ", exception:" + e);
   }
 }

 this.redrawDiffered = function () {
   setTimeout(function(){
     //Runs redraw plot on differed execution
     if (!isNull(currentObj.data)) {
       var plotlyConfig = currentObj.getPlotlyConfig(currentObj.data);
       currentObj.redrawPlot(plotlyConfig);
     }
   }, CONFIG.INMEDIATE_TIMEOUT);
 }

 this.setReadyState = function (isReady) {
   this.isReady = isReady;
   if (!isReady) {
     this.showLoading();
   } else {
     this.hideLoading();
   }
 }

 this.resize = function () {
   currentObj.clearTimeouts();

   currentObj.resizeTimeout = setTimeout(function(){
     try {
       if (currentObj.plotElem != null) {
         var size = {
           width: $(currentObj.plotElem).width(),
           height: $(currentObj.plotElem).height()
         };

         Plotly.relayout(currentObj.plotId, size);
       }
     } catch (ex) {
       log("Resize plot " + currentObj.id + " error: " + ex);
     }
   }, CONFIG.INMEDIATE_TIMEOUT);
 }

 this.mustPropagateAxisFilter = function (axis) {
   return this.plotConfig.styles.labels[axis].startsWith(this.plotConfig.axis[axis].column);
 }

 this.getAxisForPropagation = function (axis) {
   return this.plotConfig.axis[axis];
 }

 this.registerPlotEvents = function () {

   if ((this.plotConfig.styles.type == "2d")
        || (this.plotConfig.styles.type == "ligthcurve")
        || (this.plotConfig.styles.type == "colors_ligthcurve")) {

     if (!isNull(currentObj.onFiltersChanged)) {
       this.plotElem.on('plotly_selected', (eventData) => {

           if (eventData){
             var xRange = eventData.range.x;
             var yRange = eventData.range.y;
             var filters = [];

             //If plot data for label[0] is the same as axis[0] data,
             // else label data is calculated/derived with some process
             if (this.mustPropagateAxisFilter(0)){
              filters.push($.extend({ from: fixedPrecision(xRange[0], 3), to: fixedPrecision(xRange[1], 3) },
                                      this.getAxisForPropagation(0)));
             }

             //Same here but for other axis
             if (this.mustPropagateAxisFilter(1)){
                filters.push($.extend({ from: fixedPrecision(yRange[0], 3), to: fixedPrecision(yRange[1], 3) },
                                      this.getAxisForPropagation(1)));
             }

             if (filters.length > 0){
               currentObj.onFiltersChanged (filters);
             }
          }

        })
      }

      this.plotElem.on('plotly_hover', function(data){

        if (currentObj.hoverEnabled){
          currentObj.clearTimeouts();
          var hoverCoords = currentObj.getCoordsFromPlotlyHoverEvent(data);

          if (!isNull(hoverCoords)){

            currentObj.hoverCoords = hoverCoords;

            currentObj.onHoverTimeout = setTimeout(function(){
              if (!isNull(currentObj.hoverCoords)){
                currentObj.onHover(currentObj.hoverCoords);

                var evt_data = currentObj.getSwitchedCoords({ x: currentObj.hoverCoords.x, y: currentObj.hoverCoords.y });
                evt_data.labels = currentObj.plotConfig.styles.labels;
                currentObj.sendPlotEvent('on_hover', evt_data);
              }
            }, CONFIG.PLOT_TRIGGER_HOVER_TIMEOUT);
          }
        }

      }).on('plotly_unhover', function(data){
        if (currentObj.hoverEnabled){
          currentObj.onUnHoverEvent();
        }
      });

      if (isNull(this.plotEventsRegistered)){
        this.plotEventsRegistered = true;

        $( this.$html ).click(function(e) {
          currentObj.setHoverEventsEnabled(!currentObj.hoverEnabled);
        }).mouseenter(function() {

          if (!currentObj.hoverEnabled && isNull(currentObj.mouseEntered)){

            currentObj.$html.addClass("plotHover");

            currentObj.clearTimeouts();
            currentObj.mouseEntered = true;

            currentObj.onMouseEnterTimeout = setTimeout(function(){
              if (!isNull(currentObj.mouseEntered)){
                currentObj.setHoverEventsEnabled(true);
              }
            }, CONFIG.PLOT_ENABLE_HOVER_TIMEOUT);

          } else {
            currentObj.onUnHoverEvent();
          }

        }).mouseleave(function() {

          currentObj.$html.removeClass("plotHover");

          currentObj.onHoverStartTime = null;
          currentObj.mouseEntered = null;
          currentObj.onUnHoverEvent();

          if (currentObj.hoverEnabled){
            currentObj.setHoverEventsEnabled(false);
          }

        });
      }

    }
  }

  this.setHoverEventsEnabled = function (enabled) {
    if (this.hoverDisablerEnabled){
      this.hoverEnabled = enabled;
      if (this.hoverEnabled){
        this.$html.find(".hoverDisabler").hide();
      } else {
        this.$html.find(".hoverDisabler").show();
        currentObj.onUnHoverEvent();
      }
    }
  }

  this.setHoverDisablerEnabled = function (enabled) {
    this.hoverDisablerEnabled = enabled;
    if (!this.hoverDisablerEnabled){
      this.setHoverEventsEnabled(false);
      this.$html.find(".hoverDisabler").hide();
    } else {
      this.setHoverEventsEnabled(true);
    }
  }

  this.clearTimeouts = function () {
    if (!isNull(currentObj.resizeTimeout)) { clearTimeout(currentObj.resizeTimeout); currentObj.resizeTimeout = null; }
    if (!isNull(currentObj.onMouseEnterTimeout)) { clearTimeout(currentObj.onMouseEnterTimeout); currentObj.onMouseEnterTimeout = null; }
    if (!isNull(currentObj.onHoverTimeout)) { clearTimeout(currentObj.onHoverTimeout); currentObj.onHoverTimeout = null; }
    if (!isNull(currentObj.onUnHoverTimeout)) { clearTimeout(currentObj.onUnHoverTimeout); currentObj.onUnHoverTimeout = null; }
  }

  this.onUnHoverEvent = function () {
    if (!isNull(currentObj.hoverCoords)){
      currentObj.hoverCoords = null;
      currentObj.clearTimeouts();
      currentObj.onUnHoverTimeout = setTimeout(function(){
        currentObj.onUnHover();
        currentObj.sendPlotEvent('on_unhover', {});
      }, CONFIG.INMEDIATE_TIMEOUT);
    }
  }

  this.getPlotDefaultTracesCount = function (){
      return 1;
  }

  this.getCoordsFromPlotlyHoverEvent = function (data){
   if (data.points.length == 1) {
     var pt = data.points[0];
     if ((pt.curveNumber < this.getPlotDefaultTracesCount()
          && this.tracesCount == this.getPlotDefaultTracesCount())
        || !isNull(pt.data.name)){ //Avoid to resend onHover over added cross traces
       var error_x = null;
       if (!isNull(pt.data.error_x)
          && !isNull(pt.data.error_x.array)
          && pt.pointNumber < pt.data.error_x.array.length) {
         error_x = pt.data.error_x.array[pt.pointNumber];
       }
       var error_y = null;
       if (!isNull(pt.data.error_y)
          && !isNull(pt.data.error_y.array)
          && pt.pointNumber < pt.data.error_y.array.length) {
         error_y = pt.data.error_y.array[pt.pointNumber];
       }
       return { x: pt.x, y: pt.y, error_x: error_x, error_y: error_y, label: pt.data.name };
     }
   }
   return null;
  }

  this.getNearestCoordsFromEvent = function (evt_data){
    var coords = this.getSwitchedCoords( { x: 0, y: 1} );

    if (this.data != null && this.plotConfig.styles.labels[coords.x].startsWith(evt_data.labels[0])) {
      var x = closest(this.data[coords.x].values, evt_data.x);
      var idx = this.data[coords.x].values.indexOf(x);
      var y = this.data[coords.y].values[idx];

      return { x: x, y: y, error_x: null, error_y: null };
    }

    return null;
  }

  this.updateMinMaxCoords = function (){
    if (this.data != null) {
      var coords = this.getSwitchedCoords( { x: 0, y: 1} );
      var minMaxX = minMax2DArray(this.data[coords.x].values);
      var minMaxY = minMax2DArray(this.data[coords.y].values);
      this.minX = minMaxX.min;
      this.minY = minMaxY.min;
      this.maxX = minMaxX.max;
      this.maxY = minMaxY.max;
    }
  }

  this.getSwitchedCoords = function (coords) {
    if (this.isSwitched){
      var x = coords.x;
      coords.x = coords.y;
      coords.y = x;
    }
    return coords;
  }

  this.onHover = function (coords){
    if (coords != null) {
       this.setLegendText( this.getLegendTextForPoint(coords) );
       setTimeout(function(){
         currentObj.showCross(coords.x, coords.y);
       }, CONFIG.INMEDIATE_TIMEOUT);
    }
  }

  this.onUnHover = function (){
    this.setLegendText("");
    setTimeout(function(){ currentObj.hideCrosses(); }, CONFIG.INMEDIATE_TIMEOUT);
  }

  this.getLabel = function (axis) {
    return this.plotConfig.styles.labels[axis];
  }

  this.getLegendTextForPoint = function (coords) {
    try {
       if (coords == null) { return ""; }
       var swcoords = this.getSwitchedCoords( { x: 0, y: 1} );
       var labelY = !isNull(coords.label) ? coords.label : this.getLabel(swcoords.y);
       var infotextforx = this.getLabel(swcoords.x) + ': ' + (isNull(coords.x) ? "---" : coords.x.toFixed(3));
       var infotextfory = labelY + ': ' + (isNull(coords.y) ? "---" : coords.y.toFixed(3));
       var error_x_string = "";
       var error_y_string = "";
       if (!isNull(coords.error_x)) {
         error_x_string= " +/-" + coords.error_x.toFixed(3);
       }
       if (!isNull(coords.error_y)){
         error_y_string= " +/-" + coords.error_y.toFixed(3);
       }
       return infotextforx + error_x_string + '</br>' + infotextfory + error_y_string;
     } catch (ex) {
       log("getLegendTextForPoint plot " + this.id + " error: " + ex);
     }
  }

  this.setLegendText = function (text) {
   this.$hoverinfo.html(text);
  }

  this.showWarn = function (warnmsg) {
    this.$html.find(".plotTools").find(".btnWarn").remove();
    if (warnmsg != ""){
      this.btnWarn = $('<button class="btn btn-danger btnWarn ' + this.id + '"><div>' +
                         '<i class="fa fa-exclamation-triangle" aria-hidden="true"></i> ' + warnmsg +
                        '</div></button>');
      if (warnmsg.length > 50) {
        this.btnWarn.addClass("bigWarnBtn");
      }
      this.$html.find(".plotTools").prepend(this.btnWarn);
    }
  }

  this.showCross = function (x, y){
   // update two crosshair traces with new data and make it visible
   var update = { x: [[x, x], [this.minX, this.maxX]],
                  y: [[this.minY, this.maxY], [y, y]],
                  visible: true };
   Plotly.restyle(this.plotElem, update, [this.tracesCount, this.tracesCount + 1]);
  }

  this.hideCrosses = function (){
   // hide two crosshair traces
   Plotly.restyle(this.plotElem, { visible: false }, [this.tracesCount, this.tracesCount + 1]);
  }

  this.sendPlotEvent = function (evt_name, evt_data) {
    //Sends event to all plots inside the tab, uses setTimeout for avoid blocking calls
    setTimeout(function(){
      var tab = getTabForSelector(currentObj.id);
      if (tab != null) {
        tab.broadcastEventToPlots(evt_name, evt_data, currentObj.id);
      }
    }, CONFIG.INMEDIATE_TIMEOUT);
  }

  this.receivePlotEvent = function (evt_name, evt_data, senderId) {
   if (this.plotElem != null && this.isVisible && this.id != senderId) {
     switch (evt_name) {
          case 'on_hover':
              this.onHover(this.getNearestCoordsFromEvent(evt_data));
              break;
          case 'on_unhover':
              this.onUnHover();
              break;
          default:
              log("receivePlotEvent: Unhandled event: " + evt_name + ", Plot.id: " + this.id);
      }
   }
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

  this.saveAsPDF = function () {
    html2canvas(this.plotElem, {
        onrendered: function(canvas) {
          var imgData = canvas.toDataURL("image/jpeg", 1.0);
          var pdf = new jsPDF();

          pdf.addImage(imgData, 'JPEG', 0, 0);
          var download = document.getElementById('download');

          pdf.save(currentObj.plotConfig.styles.title + ".pdf");
        }
    });
  }

  this.saveAsCSV = function () {
    var data = currentObj.data;
    if (!isNull(data)){
      var csvContent = "data:text/csv;charset=utf-8,";
      data[0].values.forEach(function(values, index){
         var infoArray = [data[0].values[index], data[1].values[index]];
         if (!isNull(data[1].error_values)) {
           infoArray.push(data[1].error_values[index]); //Adds errors if available
         }
         if (data.length > 2 && (data[1].values.length == data[2].values.length)) {
           infoArray.push(data[2].values[index]); //Adds errors or extra data if available
         }
         dataString = Array.prototype.join.call(infoArray, ",");
         csvContent += index < data[0].values.length ? dataString + "\n" : dataString;
      });
      var encodedUri = encodeURI(csvContent);
      var link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", currentObj.plotConfig.styles.title + ".csv");
      link.click();
    }
  }

  this.loadCSVFile = function () {
    showLoadFile(function(e, file) {
      try {
        if ((file.type == "text/plain") || (file.type == "text/csv")) {
          var externalData = extractDatafromCSVContents(e.target.result);
          if (externalData.length > 0){
            currentObj.extraData = transposeArray(externalData);
            currentObj.redrawDiffered();
          } else {
            showError("File: " + file.name + ", data can't be extracted.");
          }
        } else {
          showError("File: " + file.name + " is not a 'text/plain' or 'text/csv' file");
        }
      } catch (e) {
        showError("File: " + file.name + " is not supported as CSV file", e);
      }
    });
  }

  this.applyValidFilters = function (filters) {

    var tab = getTabForSelector(this.id);
    if (tab != null) {

     if (isNull(this.plotConfig.mandatoryFilters)
          || this.plotConfig.mandatoryFilters.length == 0) {
        //If no mandatoryFilters just set the filters
        this.plotConfig.filters = filters;
        return;
      }

     //Sets only valid filters: Valid filters is a filter without source, or
     //filter specified on mandatoryFilters
     // This is done on two loops beacuse we want to respect the order of mandatoryFilters
     validFilters = [];

     //First append to valid filters the ones without source
     for (f in filters) {
       var filter = filters[f];
       if (!isNull(filter) && isNull(filter.source)) {
         validFilters.push(filter);
       }
     }

     //Then for each manadatory filter finds the one with that source
     for (mf in this.plotConfig.mandatoryFilters) {
       var mfilter = this.plotConfig.mandatoryFilters[mf];
       if (!isNull(mfilter)) {
         for (f in filters) {
           var filter = filters[f];
           if (!isNull(filter)
              && !isNull(filter.source)
              && filter.source == mfilter.source
              && filter.table == mfilter.table
              && filter.column == mfilter.column) {
                if (!isNull(mfilter.replaceColumnInPlot) && mfilter.replaceColumnInPlot){
                  var replacedFilter = $.extend(true, {}, filter);
                  replacedFilter.column = tab.getReplaceColumn();
                  delete replacedFilter.source;
                  validFilters.push(replacedFilter);
                } else {
                  validFilters.push(filter);
                }
              }
          }
        }
     }

     this.plotConfig.filters = validFilters;

   } else {
     log("ERROR on applyValidFilters: Plot not attached to tab, Plot: " + this.id);
   }
  }

  this.getWtiRangesFromGtis = function (gti_start, gti_stop, timevals) {

   //Prepares Wrong Time Intervals for background highlight
   var wti_ranges = [];

   if (!isNull(gti_start) && !isNull(gti_stop) && !isNull(timevals)
      && timevals.length > 0
      && gti_start.length > 0
      && gti_stop.length > 0
      && gti_start.length == gti_stop.length) {

      for (i in gti_start){
        if (i > 0) {
          if (gti_stop[i - 1] < gti_start[i]) {
            wti_ranges.push([gti_stop[i - 1], gti_start[i]]);
          }
        }
      }
   }

   return wti_ranges;
  }

  this.getConfig = function () {
    var plotConfig = $.extend(true, {}, this.plotConfig );

    //Add atributes not included in plotConfig for export
    plotConfig.id = this.id;
    plotConfig.class = this.constructor.name;
    plotConfig.isVisible = this.isVisible;
    plotConfig.fullWidth = this.$html.hasClass("fullWidth");

    return plotConfig;
  }

  this.setConfig = function (plotConfig, tab) {
    this.plotConfig = cleanPlotConfig ( $.extend(true, this.plotConfig, plotConfig) );

    if (plotConfig.isVisible) {
      this.show();

      var section = this.getSectionName();
      if ((section != "") && !isNull(tab)){
        tab.setSectionVisibility(section, true);
      }

      if (this.$html.hasClass("fullWidth") != plotConfig.fullWidth){
        this.btnFullScreen.click();
      }

    } else {
      this.hide();
    }
  }

  this.getSectionName = function () {
    if (this.$html.hasClass("LcPlot")){
      return "LcPlot";
    } else if (this.$html.hasClass("PDSPlot")){
      return "PDSPlot";
    } else if (this.$html.hasClass("TimingPlot")){
      return "TimingPlot";
    } else {
      return "";
    }
  }

  log ("new plot id: " + this.id);

  return this;
}

//Static plot METHODS
function cleanPlotConfig (plotConfig) {
  //Remove atributes not included in plotConfig for export
  delete plotConfig.id;
  delete plotConfig.class;
  delete plotConfig.isVisible;
  delete plotConfig.fullWidth;
  return plotConfig;
}

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
