//Base plot class

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
  this.annotations = [];
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
                    '<button class="btn btn-default btnStyle" data-toggle="tooltip" title="Plot style"><i class="fa fa-paint-brush" aria-hidden="true"></i></button>' +
                  '</div>' +
                  '<div class="hoverinfo"></div>' +
                '</div>');

 if (!isNull(toolbar)) {
   this.btnShow = $('<button class="btn btn-default btnShow" plotId="' + this.id + '" data-toggle="tooltip" title="Show plot"><i class="fa fa-eye" aria-hidden="true"></i></button>');
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
 this.btnStyle = this.$html.find(".btnStyle");
 this.plotElem = null;
 this.$hoverinfo = this.$html.find(".hoverinfo");

 this.show = function (){
   currentObj.isVisible = true;
   currentObj.$html.show();
   currentObj.sendPlotEvent('on_show', {});
   currentObj.refreshData();
 }

 this.hide = function (){
   currentObj.isVisible = false;
   currentObj.$html.hide();
   currentObj.sendPlotEvent('on_hide', {});
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
   if (currentObj.isExpanded()) {
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
           currentObj.setExtraData(null);
           $(this).dialog('close');
           loadDialog.remove();
        }
      }
    });
    loadDialog.parent().find(".ui-dialog-titlebar-close").html('<i class="fa fa-times" aria-hidden="true"></i>');
    currentObj.$html.append(loadDialog);
 });

 this.btnStyle.click(function( event ) {
   currentObj.sendPlotEvent('on_style_click', {});
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

 this.isExpanded = function () {
   return this.$html.hasClass("fullWidth");
 }

 this.onSelected = function (){
   this.$html.toggleClass("plotSelected");
   OnPlotSelected();
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

 this.getDefaultPlotlyConfig = function () {
   var plotDefaultConfig = $.extend(true, {}, CONFIG.PLOT_CONFIG);
   var tab = getTabForSelector(this.id);
   if (!isNull(tab)){
     plotDefaultConfig = tab.getDefaultPlotlyConfig();
   }
   return plotDefaultConfig;
 }

 this.getPlotlyConfig = function (data) {
   var coords = currentObj.getSwitchedCoords( { x: 0, y: 1} );
   var plotlyConfig = null;
   var plotDefaultConfig = currentObj.getDefaultPlotlyConfig();

   if (currentObj.plotConfig.styles.type == "2d") {
      plotlyConfig = get_plotdiv_xy(data[coords.x].values, data[coords.y].values,
                                    data[coords.x].error_values, data[coords.y].error_values,
                                    (data.length > 3) ? currentObj.getWtiRangesFromGtis(data[2].values, data[3].values, data[0].values) : [],
                                    currentObj.getLabel(coords.x),
                                    currentObj.getLabel(coords.y),
                                    currentObj.plotConfig.styles.title,
                                    plotDefaultConfig)

   } else if (currentObj.plotConfig.styles.type == "3d") {
      plotlyConfig = get_plotdiv_xyz(data[coords.x].values, data[coords.y].values, data[2].values,
                                    data[coords.x].error_values, data[coords.y].error_values, data[2].error_values,
                                    currentObj.getLabel(coords.x),
                                    currentObj.getLabel(coords.y),
                                    data[3].values,
                                    plotDefaultConfig);

   } else if (currentObj.plotConfig.styles.type == "scatter") {
      plotlyConfig = get_plotdiv_scatter(data[coords.x].values, data[coords.y].values,
                                        currentObj.getLabel(coords.x),
                                        currentObj.getLabel(coords.y),
                                        currentObj.plotConfig.styles.title,
                                        plotDefaultConfig);

   } else if (currentObj.plotConfig.styles.type == "scatter_with_errors") {
      plotlyConfig = get_plotdiv_scatter_with_errors(data[coords.x].values, data[coords.y].values,
                                                     data[coords.x].error_values, data[coords.y].error_values,
                                                     currentObj.getLabel(coords.x),
                                                     currentObj.getLabel(coords.y),
                                                     currentObj.plotConfig.styles.title,
                                                     plotDefaultConfig);

   } else if (currentObj.plotConfig.styles.type == "scatter_colored") {
      plotlyConfig = get_plotdiv_scatter_colored(data[coords.x].values, data[coords.y].values, data[2].values,
                                        currentObj.getLabel(coords.x),
                                        currentObj.getLabel(coords.y),
                                        'Amplitude<br>Map',
                                        currentObj.plotConfig.styles.title,
                                        plotDefaultConfig);

   } else if (currentObj.plotConfig.styles.type == "colors_ligthcurve") {
      plotlyConfig = get_plotdiv_xyy(data[0].values, data[1].values, data[2].values,
                                   [], [], [],
                                   (data.length > 4) ? currentObj.getWtiRangesFromGtis(data[3].values, data[4].values, data[0].values) : [],
                                   currentObj.getLabel(coords.x),
                                   currentObj.getLabel(coords.y),
                                   currentObj.getLabel(2),
                                   currentObj.plotConfig.styles.title,
                                   plotDefaultConfig);
   }

   plotlyConfig = this.addExtraDataConfig(plotlyConfig, plotDefaultConfig);
   plotlyConfig = this.prepareAxis(plotlyConfig);

   return plotlyConfig;
 }

 this.prepareAxis = function (plotlyConfig) {

   //Set the annotations
   plotlyConfig = currentObj.prepareAnnotations(plotlyConfig);

   //Set axis types
   if (currentObj.plotConfig.xAxisType == "log") {
     plotlyConfig.layout.xaxis.type = 'log';
     plotlyConfig.layout.xaxis.autorange = true;
   }

   if (currentObj.plotConfig.yAxisType == "log") {
     plotlyConfig.layout.yaxis.type = 'log';
     plotlyConfig.layout.yaxis.autorange = true;
   }

   if (!isNull(currentObj.plotStyle)) {
     plotlyConfig = $.extend(true, plotlyConfig, currentObj.plotStyle);
   }

   return plotlyConfig;
 }

 this.prepareAnnotations = function (plotlyConfig) {

   //Adds only visible annotations in X and Y range
   if (currentObj.annotations.length > 0){
    var annotations = $.extend(true, [], currentObj.annotations);
    var isXY = !isNull(currentObj.plotConfig.plotType) && currentObj.plotConfig.plotType == "X*Y";
    if (currentObj.isSwitched || isXY) {
      //Switch annotations axes or calculates X*Y
      for (i in annotations){
         if (isXY) { annotations[i].y = annotations[i].y * annotations[i].x };
         if (currentObj.isSwitched) { annotations[i] = currentObj.getSwitchedCoords(annotations[i]) };
       };
    }
    var visibleAnnotations = annotations.filter(function(annotation) {
        return (annotation.x >= currentObj.minX)
             && (annotation.x <= currentObj.maxX)
             && (annotation.y >= currentObj.minY)
             && (annotation.y <= currentObj.maxY)
             && (isNull(annotation.opacity) || (annotation.opacity > 0));
      });
    if (visibleAnnotations.length > 0){
      plotlyConfig.layout.annotations = $.extend(true, [], visibleAnnotations);
      //Fixes plotly.js annotations position bug with Log axis
      var xLog = currentObj.plotConfig.xAxisType == "log";
      var yLog = currentObj.plotConfig.yAxisType == "log";

      for (i in plotlyConfig.layout.annotations){
         var annotation = plotlyConfig.layout.annotations[i];
         if (xLog) { annotation.x = Math.log(annotation.x)/ Math.log(10); };
         if (yLog) { annotation.y = Math.log(annotation.y)/ Math.log(10); };
       };
    };
   }

   return plotlyConfig;
 }

 this.addExtraDataConfig = function (plotlyConfig, plotDefaultConfig) {
   if (!isNull(this.extraData)
       && this.extraData.length > 1
       && plotlyConfig.data.length > 0){
     //If plot config has data, clones first trace and changes its axis data and color
     var extraTrace = $.extend(true, {}, plotlyConfig.data[0]);
     var coords = this.getSwitchedCoords( { x: this.extraData[0], y: this.extraData[1]} );
     extraTrace.x = coords.x;
     extraTrace.y = coords.y;
     if (!isNull(extraTrace.line)) {
       extraTrace.line = $.extend(true, extraTrace.line, { color : plotDefaultConfig.EXTRA_DATA_COLOR });
     }
     if (!isNull(extraTrace.marker)) {
       extraTrace.marker = $.extend(true, extraTrace.marker, { color : plotDefaultConfig.EXTRA_DATA_COLOR });
     }
     if (this.extraData.length > 2
         && this.extraData[2].length > 0
         && jQuery.isNumeric(this.extraData[2][0])) {
           //If third extra data column is numeric
           if (this.extraData.length > 3
               && this.extraData[3].length > 0
               && jQuery.isNumeric(this.extraData[3][0])) {
                 //If fourth extra data column is numeric also, consider both columns as errors
                 var error_coords = this.getSwitchedCoords( { x: this.extraData[2], y: this.extraData[3]} );
                 extraTrace.error_x = getErrorConfig(error_coords.x, plotDefaultConfig);
                 extraTrace.error_y = getErrorConfig(error_coords.y, plotDefaultConfig);
           } else if (!this.isSwitched){
             //Consider third column as y_error
             extraTrace.error_y = getErrorConfig(this.extraData[2], plotDefaultConfig);
           } else {
             //Consider third column as x_error
             extraTrace.error_x = getErrorConfig(this.extraData[2], plotDefaultConfig);
           }
     }
     extraTrace.comesFromExtra = true;
     plotlyConfig.data.splice(0, 0, extraTrace);

     if (!isNull(this.plotStyle)){
       var extraTraceStyle = this.plotStyle.data.filter(function(trace) { return !isNull(trace.comesFromExtra) && trace.comesFromExtra; });
       if (isNull(extraTraceStyle) || extraTraceStyle.length == 0) {
         this.plotStyle.data.splice(0, 0, getTracePlotStyle(extraTrace));
         this.sendPlotEvent('on_plot_styles_changed', {});
       }
     }
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
   currentObj.clearTimeouts();

   currentObj.redrawTimeout = setTimeout(function(){
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
      }

      if (this.plotConfig.styles.type != "3d") {
        this.plotElem.on('plotly_click', function(data){
            if (data.points.length > 0){
              currentObj.showAddAnnotationDialog(data.points[0].x, data.points[0].y);
            }
        });
      }

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
    if (!isNull(currentObj.redrawTimeout)) { clearTimeout(currentObj.redrawTimeout); currentObj.redrawTimeout = null; }
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

      if (!isNull(this.extraData)
          && this.extraData.length > 1) {
          var extraMinMaxX = minMax2DArray(this.extraData[coords.x]);
          var extraMinMaxY = minMax2DArray(this.extraData[coords.y]);
          this.minX = Math.min(minMaxX.min, extraMinMaxX.min);
          this.minY = Math.min(minMaxY.min, extraMinMaxY.min);
          this.maxX = Math.max(minMaxX.max, extraMinMaxX.max);
          this.maxY = Math.max(minMaxY.max, extraMinMaxY.max);
      }
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

  this.setLabel = function (axis, value) {
    this.plotConfig.styles.labels[axis] = value;
  }

  this.getLegendTextForPoint = function (coords) {
    try {
       if (coords == null) { return ""; }
       var swcoords = this.getSwitchedCoords( { x: 0, y: 1} );
       var maxLabelLength = (this.isExpanded()) ? 60 : 20;
       var labelY = !isNull(coords.label) ? coords.label : this.getLabel(swcoords.y);
       var infotextforx = truncateText(this.getLabel(swcoords.x), maxLabelLength) + ': ' + (isNull(coords.x) ? "---" : coords.x.toFixed(3));
       var infotextfory = truncateText(labelY, maxLabelLength) + ': ' + (isNull(coords.y) ? "---" : coords.y.toFixed(3));
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

  this.showAddAnnotationDialog = function (x, y){
   //Shows a dialog that allows user to add a text label to a given point
   var addLabelDialog = $('<div id="dialog_' + currentObj.id +  '" title="Add annotation to (' + x + ', ' + y + ')">' +
                            '<fieldset>' +
                              '<label for="labelText">Annotation text:</label>' +
                              '<input type="text" style="width: 95%; text-align: left" name="labelText" value="(' + x + ', ' + y + ')">' +
                            '</fieldset>' +
                          '</div>');
   currentObj.$html.append(addLabelDialog);
   addLabelDialog.dialog({
      width: '300px',
      buttons: {
        'Add label': function() {
           var labelText = $('#dialog_' + currentObj.id).find('input[name="labelText"]').val();
           currentObj.addAnnotation(labelText, x, y);
           $(this).dialog('close');
        },
        'Clear all': function() {
           currentObj.annotations = [];
           currentObj.redrawDiffered();
           $(this).dialog('close');
        },
        'Cancel': function() {
           $(this).dialog('close');
        }
      },
      close: function() {
        addLabelDialog.remove();
      }
    });
    addLabelDialog.parent().find(".ui-dialog-titlebar-close").html('<i class="fa fa-times" aria-hidden="true"></i>');

  }

  this.addAnnotation = function (text, x, y){
    if (text != ""){
      if (!isNull(this.plotConfig.plotType) && this.plotConfig.plotType == "X*Y") { y = y / x; }
      log("addAnnotation: " + text + " to (" + x + "," + y + "), Plot.id: " + this.id);
      this.annotations.push(getAnnotation(text, x, y, this.getDefaultPlotlyConfig().ANNOTATION_ARROWHEAD));
      this.redrawDiffered();
      this.sendPlotEvent('on_plot_styles_changed', {});
    }
  }

  this.sendPlotEvent = function (evt_name, evt_data) {
    //Sends event to all plots inside the tab, uses setTimeout for avoid blocking calls
    setTimeout(function(){
      var tab = getTabForSelector(currentObj.id);
      if (tab != null) {
        tab.broadcastEvent(evt_name, evt_data, currentObj.id);
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

      //Prepares annotations for export, gets the closest index for each annotation
      var annotations = [];
      if (currentObj.annotations.length > 0){
        for (i in currentObj.annotations){
          var annotation = currentObj.annotations[i];
          var x = closest(currentObj.data[0].values, annotation.x);
          var idx = this.data[0].values.indexOf(x);
          annotations[idx] = annotation;
        }
      }

      //Saves points as CSV lines
      data[0].values.forEach(function(values, index){
         var infoArray = [data[0].values[index], data[1].values[index]];
         for (axis = 0; axis < 2; axis ++){ // Axis = 0, 1
           if (!isNull(data[axis].error_values)) {
             infoArray.push(data[axis].error_values[index]); //Adds X, Y errors if available
           }
         }
         if (data.length > 2 && (data[1].values.length == data[2].values.length)) {
           infoArray.push(data[2].values[index]); //Adds errors or extra data if available
         }
         //Adds the annotation text if exists as last column
         infoArray.push(!isNull(annotations[index]) ? "'" + annotations[index].text.replace(/\,/g,';') + "'" : "");
         dataString = Array.prototype.join.call(infoArray, ",");
         csvContent += index < data[0].values.length ? dataString + "\n" : dataString;
      });

      saveRawToFile(currentObj.plotConfig.styles.title + ".csv", csvContent);
    }
  }

  this.loadCSVFile = function () {
    showLoadFile(function(e, file) {
      try {
        if ((file.type == "text/plain") || (file.type == "text/csv")) {
          var externalData = extractDatafromCSVContents(e.target.result);
          if (externalData.length > 0){
            currentObj.setExtraData(transposeArray(externalData));
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

  this.setExtraData = function (extraData) {
    this.extraData = extraData;

    //Prepare annotations
    if (!isNull(this.extraData)
        && (this.extraData.length > 2)) {
      var annotationsArr = this.extraData[this.extraData.length - 1];
      var plotDefaultConfig = this.getDefaultPlotlyConfig();

      for (i in annotationsArr){
        var text = annotationsArr[i];
        if (text != "" && !jQuery.isNumeric(text)){
          //Add annotations from extraData
          var annotation = getAnnotation(text.replace(/\'/g,''),
                                         this.extraData[0][i],
                                         this.extraData[1][i],
                                         plotDefaultConfig.ANNOTATION_ARROWHEAD);
          annotation.comesFromExtra = true;
          this.annotations.push(annotation);
        }
      }
    } else {
      //Remove annotations from extraData
      this.annotations = this.annotations.filter(function(annotation) { return isNull(annotation.comesFromExtra) || !annotation.comesFromExtra; });

      //Remove trace style from extraData
      if (!isNull(this.plotStyle)){
        this.plotStyle.data = this.plotStyle.data.filter(function(trace) { return isNull(trace.comesFromExtra) || !trace.comesFromExtra; });
      }
    }

    this.updateMinMaxCoords();
    this.sendPlotEvent('on_plot_styles_changed', {});
    this.redrawDiffered();
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
    plotConfig.fullWidth = this.isExpanded();
    plotConfig.annotations = this.annotations;
    plotConfig.plotStyle = this.plotStyle;

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

      if (this.isExpanded() != plotConfig.fullWidth){
        this.btnFullScreen.click();
      }

      if (!isNull(plotConfig.annotations)){
        this.annotations = $.extend(true, [], plotConfig.annotations);
      }

      if (!isNull(plotConfig.plotStyle)){
        this.plotStyle = $.extend(true, {}, plotConfig.plotStyle);
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

  this.getStyleJQElem = function () {
      var $style = $('<div class="plotStyle marginTop">' +
                      '<div class="floatingContainer">' +
                        '<button class="btn button btnClear" data-toggle="tooltip" title="Clear style"><i class="fa fa-eraser" aria-hidden="true"></i></button>' +
                      '</div>' +
                    '</div>');

      $style.find(".btnClear").click(function () {
        currentObj.plotStyle = null;
        currentObj.sendPlotEvent('on_style_click', {});
        currentObj.redrawDiffered();
      });

      $style = this.addTitleAndAxisLabelsToStyleJQElem($style);
      $style = this.addPlotConfigStyleJQElem($style);
      return $style;
  }

  this.addTitleAndAxisLabelsToStyleJQElem = function ($style) {

    //Adds the title style controls
    $style.append(getTextBox ("TITLE" + this.id, "inputTITLE width100",
                              "Title", !isNull(this.plotConfig.styles.title) ? this.plotConfig.styles.title : "",
                              function(value, input) {
                                currentObj.plotConfig.styles.title = value;
                                currentObj.redrawDiffered();
                              }));

    //Adds the axis labels style controls
    for (axis in this.plotConfig.styles.labels){
      $style.append(getTextBox ("LABEL_" + axis + "_" + this.id, "inputLABEL" + axis + " width100",
                                "Label " + axis, this.getLabel(axis),
                                function(value, input) {
                                  var axis = input.attr("name").split("_")[1];
                                  currentObj.setLabel(axis, value);
                                  currentObj.redrawDiffered();
                                }));
    }

    return $style;
  }

  this.addPlotConfigStyleJQElem = function ($style) {

    if (!isNull(this.data)) {
      var plotlyConfig = currentObj.getPlotlyConfig(currentObj.data);
      var plotDefaultConfig = currentObj.getDefaultPlotlyConfig();

      //Prepares or updates plot style object
      if (isNull(currentObj.plotStyle)
          || currentObj.plotStyle.data.length != plotlyConfig.data.length){
        currentObj.plotStyle = getEmptyPlotStyle(plotlyConfig);
      }

      if (!isNull(plotlyConfig)) {

        //For each trace in the plot
        for (traceIdx in plotlyConfig.data){
          var trace = plotlyConfig.data[traceIdx];
          if ((trace.type != "surface")
              && (trace.type != "heatmap")
              && !isNull(trace.x)) {
            //If not is 3d or heatmap type plot and has data
            $style.append($('<h3 class="clear">Trace ' + traceIdx + ':</h3>'));

            if (!isNull(trace.line)){
              $style.append($('<p class="clear">Line style:</p>'));

              //Adds the line color selector
              var colorPickerId = "colorPickerLn_" + traceIdx + "_" + this.id;
              $style.append(getColorPicker(colorPickerId, trace.line.color, function (color, id) {
                var traceIdx = id.split("_")[1];
                currentObj.plotStyle.data[traceIdx].line.color = color;
                currentObj.redrawDiffered();
              }));

              //Adds the line width
              $style.append(getInlineRangeBox ("lineWidth_" + traceIdx + "_" + this.id, "inputLineWidth",
                                          "Line width", trace.line.width, plotDefaultConfig.DEFAULT_LINE_WIDTH.min, plotDefaultConfig.DEFAULT_LINE_WIDTH.max,
                                          function(value, input) {
                                            var traceIdx = input.attr("name").split("_")[1];
                                            currentObj.plotStyle.data[traceIdx].line.width = value;
                                            currentObj.redrawDiffered();
                                          }));

              var $lineOpacity = getInlineRangeBox ("lineOpacity_" + traceIdx + "_" + this.id, "inputLineOpacity float",
                                          "Opacity", !isNull(trace.opacity) ? trace.opacity : 1, 0, 1,
                                          function(value, input) {
                                            var traceIdx = input.attr("name").split("_")[1];
                                            currentObj.plotStyle.data[traceIdx].opacity = value;
                                            currentObj.redrawDiffered();
                                          });
              $lineOpacity.attr("style", "margin-top: -4px;");
              $style.append($lineOpacity);
            }

            if (!isNull(trace.marker)){

              //Adds the marker type selector
              $style.append(getRadioControl("markerType_" + traceIdx + "_" + this.id,
                                            "Marker type",
                                            "markerType",
                                            [
                                              { id:"circle", label:"circle", value:"circle" },
                                              { id:"circle-open", label:"circle-open", value:"circle-open" },
                                              { id:"square", label:"square", value:"square" },
                                              { id:"square-open", label:"square-open", value:"square-open" },
                                              { id:"diamond", label:"diamond", value:"diamond" },
                                              { id:"diamond-open", label:"diamond-open", value:"diamond-open" },
                                              { id:"cross", label:"cross", value:"cross" },
                                              { id:"x", label:"x", value:"x" }
                                            ],
                                            !isNull(trace.marker.symbol) ? trace.marker.symbol : "circle",
                                            function(value, id) {
                                              var traceIdx = id.split("_")[1];
                                              currentObj.plotStyle.data[traceIdx].marker.symbol = value;
                                              currentObj.redrawDiffered();
                                            },
                                            "smallTextStyle"));

              //Adds the marker style
              $style.append($('<p class="clear marginTop">Markers style:</p>'));

              //Adds the marker color selector
              var colorPickerId = "colorPickerMk_" + traceIdx + "_" + this.id;
              $style.append(getColorPicker(colorPickerId, trace.marker.color, function (color, id) {
                var traceIdx = id.split("_")[1];
                currentObj.plotStyle.data[traceIdx].marker.color = color;
                currentObj.redrawDiffered();
              }));

              //Adds the marker size
              $style.append(getInlineRangeBox ("markerSize_" + traceIdx + "_" + this.id, "inputMarkerSize",
                                          "Marker size", trace.marker.size, plotDefaultConfig.DEFAULT_MARKER_SIZE.min, plotDefaultConfig.DEFAULT_MARKER_SIZE.max,
                                          function(value, input) {
                                            var traceIdx = input.attr("name").split("_")[1];
                                            currentObj.plotStyle.data[traceIdx].marker.size = value;
                                            currentObj.redrawDiffered();
                                          }));

              var $markerOpacity = getInlineRangeBox ("markerOpacity_" + traceIdx + "_" + this.id, "inputMarkerOpacity float",
                                          "Opacity", trace.marker.opacity, 0, 1,
                                          function(value, input) {
                                            var traceIdx = input.attr("name").split("_")[1];
                                            currentObj.plotStyle.data[traceIdx].marker.opacity = value;
                                            currentObj.redrawDiffered();
                                          });
              $markerOpacity.attr("style", "margin-top: -4px;");
              $style.append($markerOpacity);
            }

            if (!isNull(trace.error_x)
                && !isNull(trace.error_x.array)
                && trace.error_x.array.length > 0){
              $style.append($('<p class="clear">Error X style:</p>'));

              //Adds the error_x color selector
              var colorPickerId = "colorPickerEx_" + traceIdx + "_" + this.id;
              $style.append(getColorPicker(colorPickerId, "#" + RGBAStrToHex(trace.error_x.color), function (color, id) {
                var traceIdx = id.split("_")[1];
                var rgba = RGBAStrToRGBA(!isNull(currentObj.plotStyle.data[traceIdx].error_x.color) ?
                                                  currentObj.plotStyle.data[traceIdx].error_x.color :
                                                  currentObj.getDefaultPlotlyConfig().ERROR_BAR_COLOR);
                currentObj.plotStyle.data[traceIdx].error_x.color = HexAndAlphaToRGBAStr (color, rgba.a);
                currentObj.redrawDiffered();
              }));

              //Adds the error_x opacity
              $style.append(getInlineRangeBox ("errorXOpacity_" + traceIdx + "_" + this.id, "inputErrorXOpacity float",
                                          "Opacity", RGBAStrToRGBA(trace.error_x.color).a, 0, 1,
                                          function(value, input) {
                                            var traceIdx = input.attr("name").split("_")[1];
                                            var rgba = RGBAStrToRGBA(!isNull(currentObj.plotStyle.data[traceIdx].error_x.color) ?
                                                                              currentObj.plotStyle.data[traceIdx].error_x.color :
                                                                              currentObj.getDefaultPlotlyConfig().ERROR_BAR_COLOR);
                                            currentObj.plotStyle.data[traceIdx].error_x.color = HexAndAlphaToRGBAStr (RGBToHex(rgba), value);
                                            currentObj.redrawDiffered();
                                          }));
            }

            if (!isNull(trace.error_y)
                && !isNull(trace.error_y.array)
                && trace.error_y.array.length > 0){
              $style.append($('<p class="clear">Error Y style:</p>'));

              //Adds the error_y color selector
              var colorPickerId = "colorPickerEy_" + traceIdx + this.id;
              $style.append(getColorPicker(colorPickerId, "#" + RGBAStrToHex(trace.error_y.color), function (color, id) {
                var traceIdx = id.replace("colorPickerEy_","").replace(currentObj.id, "");
                var rgba = RGBAStrToRGBA(!isNull(currentObj.plotStyle.data[traceIdx].error_y.color) ?
                                                  currentObj.plotStyle.data[traceIdx].error_y.color :
                                                  currentObj.getDefaultPlotlyConfig().ERROR_BAR_COLOR);
                currentObj.plotStyle.data[traceIdx].error_y.color = HexAndAlphaToRGBAStr (color, rgba.a);
                currentObj.redrawDiffered();
              }));

              //Adds the error_y opacity
              $style.append(getInlineRangeBox ("errorYOpacity_" + traceIdx + "_" + this.id, "inputErrorYOpacity float",
                                          "Opacity", RGBAStrToRGBA(trace.error_y.color).a, 0, 1,
                                          function(value, input) {
                                            var traceIdx = input.attr("name").split("_")[1];
                                            var rgba = RGBAStrToRGBA(!isNull(currentObj.plotStyle.data[traceIdx].error_y.color) ?
                                                                        currentObj.plotStyle.data[traceIdx].error_y.color :
                                                                        currentObj.getDefaultPlotlyConfig().ERROR_BAR_COLOR);
                                            currentObj.plotStyle.data[traceIdx].error_y.color = HexAndAlphaToRGBAStr (RGBToHex(rgba), value);
                                            currentObj.redrawDiffered();
                                          }));
            }
          }
        }

        //If there are annotations:
        if (!isNull(currentObj.annotations)
            && currentObj.annotations.length > 0){

          $style.append($('<h3>Annotations:</h3>'));

          //For each annotation in the plot
          for (annotationIdx in currentObj.annotations){

            var annotation = currentObj.annotations[annotationIdx];

            if (annotationIdx > 0) { $style.append("</br></br></br>"); }

            var deleteBtnWrp = $('<div class="switch-wrapper">' +
                                    '<div class="delete-btn fa fa-trash-o" annId="' + annotationIdx + '" aria-hidden="true"></div>' +
                                  '</div>');
            var deleteBtn = deleteBtnWrp.find(".delete-btn");
            deleteBtn.click( function ( event ) {
              var annIdx = $(this).attr("annId");
              currentObj.annotations.splice(annIdx,1);
              currentObj.redrawDiffered();
              currentObj.sendPlotEvent('on_plot_styles_changed', {});
            });
            $style.append(deleteBtnWrp);

            $style.append(getTextBox ("ANNTEXT_" + annotationIdx + "_" + this.id, "inputANNTEXT",
                                              "Annotation", annotation.text,
                                              function(value, input) {
                                                var annIdx = input.attr("name").split("_")[1];
                                                currentObj.annotations[annIdx].text = value;
                                                currentObj.redrawDiffered();
                                              }));

            $style.append(getBooleanBox ("Show arrow",
                                        "chkShowArrow_" + annotationIdx, annotation.showarrow,
                                        function(enabled, cssClass) {
                                          var annIdx = cssClass.split("_")[1];
                                          currentObj.annotations[annIdx].showarrow = enabled;
                                          currentObj.redrawDiffered();
                                        }));

            var colorPickerId = "colorPickerAnn_" + annotationIdx + "_" + this.id;
            $style.append(getColorPicker(colorPickerId, annotation.arrowcolor , function (color, id) {
              var annIdx = id.split("_")[1];
              currentObj.annotations[annIdx].arrowcolor = color;
              currentObj.annotations[annIdx].font = { color: color };
              currentObj.redrawDiffered();
            }));

            $style.append(getInlineRangeBox ("arrowHead_" + annotationIdx + "_" + this.id, "inputArrowHead",
                                        "Arrow head", annotation.arrowhead, 0, 7,
                                        function(value, input) {
                                          var annIdx = input.attr("name").split("_")[1];
                                          currentObj.annotations[annIdx].arrowhead = value;
                                          currentObj.redrawDiffered();
                                        }));

            var opacityBox = getInlineRangeBox ("annOpacity_" + annotationIdx + "_" + this.id, "inputAnnOpacity float",
                                        "Opacity", (!isNull(annotation.opacity) ? annotation.opacity : 1), 0, 1,
                                        function(value, input) {
                                          var annIdx = input.attr("name").split("_")[1];
                                          currentObj.annotations[annIdx].opacity = value;
                                          currentObj.redrawDiffered();
                                        });
            opacityBox.attr("style", "margin-top: 0px;")
            $style.append(opacityBox);
          }
        }
      }
    }

    return $style;
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
