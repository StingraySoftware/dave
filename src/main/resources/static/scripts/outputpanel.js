function OutputPanel (classSelector, toolBarSelector, service, onFiltersChangedFromPlotFn) {

  var currentObj = this;

  this.classSelector = classSelector;
  this.toolBarSelector = toolBarSelector;
  this.service = service;
  this.onFiltersChangedFromPlot = onFiltersChangedFromPlotFn;
  this.$html = $(this.classSelector);
  this.$toolBar = $(this.toolBarSelector);
  this.plots = [];


  //METHODS AND EVENTS
  this.initPlots = function(filename, bck_filename, gti_filename, schema) {
    //PLOTS HARDCODED BY THE MOMENT HERE
    if (!filename.endsWith(".txt")) {
      this.plots = this.getFitsTablePlots(filename, bck_filename, gti_filename, schema);
    } else {
      this.plots = this.getTxtTablePlots(filename);
    }

    //ADDS PLOTS TO PANEL
    for (i in this.plots) { this.$html.append(this.plots[i].$html); };
    this.forceResize();
  };

  this.resize = function() {
    for (i in this.plots) { this.plots[i].resize(); };
  }

  this.forceResize = function () {
    $(window).trigger("resize");
  }

  this.onDatasetChanged = function ( filename, bck_filename, gti_filename, schema ) {

    // Clears output panel
    this.$html.html("");

    // Adds plots
    this.initPlots(filename, bck_filename, gti_filename, schema);

    // Adds FITS info if found
    if (!isNull(schema["EVENTS"]) && !isNull(schema["EVENTS"]["HEADER"])) {
      var theInfoPanel = new infoPanel("infoPanel", "EVENTS HEADER:", schema["EVENTS"]["HEADER"], schema["EVENTS"]["HEADER_COMMENTS"]);
      this.$html.append(theInfoPanel.$html);
    }
  }

  this.onDatasetValuesChanged = function ( filename, filters ) {
    waitingDialog.show('Retrieving plots data...');
    log("onDatasetValuesChanged:" + filename + ", filters: " + JSON.stringify(filters) );
    for (i in this.plots) { this.plots[i].onDatasetValuesChanged( filename, filters ); };
  }

  this.onPlotReady = function () {
    var allPlotsReady = true;
    for (i in currentObj.plots) { allPlotsReady = allPlotsReady && currentObj.plots[i].isReady; };
    if (allPlotsReady) { waitingDialog.hide(); }
  }

  //This aplply only while final plots are defined by team
  this.getTxtTablePlots = function ( filename ) {
    return [
                new Plot(
                  "time_rate_" + filename,
                  {
                    filename: filename,
                    styles: { type: "2d", labels: ["Time (" + theTimeUnit  + ")", "Rate"] },
                    axis: [ { table:"txt_table", column:"Time" } ,
                            { table:"txt_table", column:"Rate" } ]
                  },
                  this.service.request_plot_data,
                  this.onFiltersChangedFromPlot,
                  this.onPlotReady,
                  this.$toolBar
                ),

                new Plot(
                  "color1_color2_" + filename,
                  {
                    filename: filename,
                    styles: { type: "2d", labels: ["color1", "color2"] },
                    axis: [ { table:"txt_table", column:"color1" } ,
                            { table:"txt_table", column:"color2" } ]
                  },
                  this.service.request_plot_data,
                  this.onFiltersChangedFromPlot,
                  this.onPlotReady,
                  this.$toolBar
                ),

                new Plot(
                  "Time_Rate_Amplitude_" + filename,
                  {
                    filename: filename,
                    styles: { type: "3d", labels: ["Time (" + theTimeUnit  + ")", "Rate", "Amplitude"] },
                    axis: [ { table:"txt_table", column:"Time" } ,
                            { table:"txt_table", column:"Rate" } ,
                            { table:"txt_table", column:"Amplitude" } ]
                  },
                  this.service.request_plot_data,
                  this.onFiltersChangedFromPlot,
                  this.onPlotReady,
                  this.$toolBar
                ),

                new Plot(
                  "Time_Frecuency_" + filename,
                  {
                    filename: filename,
                    styles: { type: "scatter", labels: ["Time (" + theTimeUnit  + ")", "Frequency"] },
                    axis: [ { table:"txt_table", column:"Time" } ,
                            { table:"txt_table", column:"Rate" } ]
                  },
                  this.service.request_plot_data,
                  this.onFiltersChangedFromPlot,
                  this.onPlotReady,
                  this.$toolBar
                )
              ];
  }

  this.getFitsTablePlots = function ( filename, bck_filename, gti_filename, schema ) {

    log("getFitsTablePlots: theBinSize: " + theBinSize );

    return [
              /*new Plot(
                "time_pi_" + filename,
                {
                  filename: filename,
                  styles: { type: "scatter", labels: ["TIME", "PI"] },
                  axis: [ { table:"EVENTS", column:"TIME" } ,
                          { table:"EVENTS", column:"PI" } ]
                },
                this.service.request_plot_data,
                this.onFiltersChangedFromPlot,
                this.onPlotReady,
                this.$toolBar
              ),*/

              new Plot(
                  "ligthcurve_" + filename,
                  {
                    filename: filename,
                    bck_filename: bck_filename,
                    gti_filename: gti_filename,
                    styles: { type: "ligthcurve", labels: ["TIME (" + theTimeUnit  + ")", "Count Rate(c/s)"] },
                    axis: [ { table:"EVENTS", column:"TIME" },
                            { table:"EVENTS", column:"PI" } ]
                  },
                  this.service.request_lightcurve,
                  this.onFiltersChangedFromPlot,
                  this.onPlotReady,
                  this.$toolBar,
                  "fullWidth"
                ),

                new Plot(
                    "colors_ligthcurve_" + filename,
                    {
                      filename: filename,
                      bck_filename: bck_filename,
                      gti_filename: gti_filename,
                      styles: { type: "colors_ligthcurve", labels: ["TIME (" + theTimeUnit  + ")", "SCR", "HCR"] },
                      axis: [ { table:"EVENTS", column:"TIME" },
                              { table:"EVENTS", column:"SCR_HCR" } ]
                    },
                    this.service.request_colors_lightcurve,
                    this.onFiltersChangedFromPlot,
                    this.onPlotReady,
                    this.$toolBar,
                    "fullWidth"
                  )

              ];
  }

  log ("Output panel ready!!");
 }
