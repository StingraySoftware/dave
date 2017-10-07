function OutputPanel (id, classSelector, container, service, onFiltersChangedFromPlotFn, getFiltersFn) {

  var currentObj = this;

  this.id = id;
  this.classSelector = classSelector;
  this.service = service;
  this.onFiltersChangedFromPlot = onFiltersChangedFromPlotFn;
  this.getFilters = getFiltersFn;
  this.$html = cloneHtmlElement(id, classSelector);
  container.html(this.$html);
  this.$html.show();
  this.$body =  this.$html.find(".outputPanelBody");
  this.plots = [];

  //METHODS AND EVENTS
  this.resize = function() {
    for (i in this.plots) { this.plots[i].resize(); };
  }

  this.forceResize = function () {
    $(window).trigger("resize");
  }

  this.onDatasetValuesChanged = function ( filters ) {
    waitingDialog.hide();

    if (isNull(filters)) {
      filters = this.getFilters();
    }
    log("onDatasetValuesChanged: filters: " + JSON.stringify( filters ) );
    for (i in this.plots) { this.plots[i].onDatasetValuesChanged( filters ); };

    setTimeout(this.onPlotReady, 500);
  }

  this.onPlotReady = function () {
    for (i in currentObj.plots) { if (currentObj.plots[i].isVisible && !currentObj.plots[i].isReady) return; };
  }

  this.enableDragDrop = function (enabled) {
    if (isNull(this.dragDropEnabled)) {
      currentObj.$body.sortable({ revert: true });
    }

    this.dragDropEnabled = enabled;
    currentObj.$body.sortable( "option", "disabled", !this.dragDropEnabled );
  }

  this.containsId = function (id) {
    return (this.id == id) || this.getPlotById(id) != null;
  }

  this.getPlotById = function (id) {
    for (i in this.plots) {
      if (this.plots[i].id == id) {
          return this.plots[i];
      }
    }
    return null;
  }

  this.setPlotsReadyState = function(ready) {
    for (i in this.plots) {
      if (this.plots[i].isVisible) {
          this.plots[i].setReadyState(ready);
      }
    }
  }

  this.generatePlotId = function (id) {
    return (this.id + "_" + id + "_" + (new Date()).getTime()).replace(/\./g,'').replace(/\//g,'');
  }

  this.broadcastEvent = function (evt_name, evt_data, senderId) {
    for (i in this.plots) {
      this.plots[i].receivePlotEvent(evt_name, evt_data, senderId);
    }
  }

  this.appendPlot = function (plot, refreshData) {
    if (isNull(this.getPlotById(plot.id))) {
      this.plots.push(plot);
    }

    var infoPanels = this.$body.find(".infoPanel");
    if (infoPanels.length > 0) {
      plot.$html.insertBefore(infoPanels.first());
    } else {
      this.$body.append(plot.$html);
    }

    if (isNull(refreshData) || refreshData) {
      plot.onDatasetValuesChanged(this.getFilters());
    }
  }

  this.removePlotsById = function (plotIds) {
    var tab = getTabForSelector(this.id);
    for (plotIdx in plotIds){
      var plotId = plotIds[plotIdx];
      var plot = this.getPlotById(plotId);
      if (!isNull(plot)) {
        plot.$html.remove();
        tab.$html.find(".sectionContainer").find("." + plot.id).remove();
        this.plots = this.plots.filter(function(plot) {
                          return plot.id !== plotId;
                      });
      }
    }
  }

  this.getConfig = function () {
    var plotConfigs = [];
    for (i in this.plots) {
       plotConfigs.push(this.plots[i].getConfig());
     };
     return plotConfigs;
  }

  this.setConfig = function (plotConfigs) {
    var tab = getTabForSelector(this.id);

    if (plotConfigs.length == this.plots.length){
        for (i in this.plots) {
          this.plots[i].setConfig(plotConfigs[i], tab);
         };
     } else {
       log ("Output.setConfig ERROR: Number of plots mismatch");
     }
  }

  log ("Output panel ready!!");
  return this;
 }
