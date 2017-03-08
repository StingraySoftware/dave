function OutputPanel (id, classSelector, toolBarSelector, container, service, onFiltersChangedFromPlotFn) {

  var currentObj = this;

  this.id = id;
  this.classSelector = classSelector;
  this.toolBarSelector = toolBarSelector;
  this.service = service;
  this.onFiltersChangedFromPlot = onFiltersChangedFromPlotFn;
  this.$html = cloneHtmlElement(id, classSelector);
  container.html(this.$html);
  this.$html.show();
  this.$toolBar = $(this.toolBarSelector);
  this.plots = [];


  //METHODS AND EVENTS
  this.initPlots = function(projectConfig) {
    //PLOTS HARDCODED BY THE MOMENT HERE
    if (!projectConfig.filename.endsWith(".txt")) {

      if (!isNull(projectConfig.schema["RATE"])) {

        //If fits is a Lightcurve
        this.plots = this.getLcTablePlots(projectConfig.filename,
                                            projectConfig.getFile("LCA"),
                                            projectConfig.getFile("LCB"),
                                            projectConfig.getFile("LCC"),
                                            projectConfig.getFile("LCD"),
                                            projectConfig.binSize,
                                            projectConfig.timeUnit);
      } else {

        //If fits is an Events fits
        this.plots = this.getFitsTablePlots(projectConfig.filename,
                                            projectConfig.bckFilename,
                                            projectConfig.gtiFilename,
                                            projectConfig.binSize,
                                            projectConfig.timeUnit);
      }

    } else {

        //If file has txt extension
        this.plots = this.getTxtTablePlots(projectConfig.filename,
                                          projectConfig.timeUnit);
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

  this.onDatasetChanged = function ( projectConfig ) {

    // Clears output panel
    this.$html.html("");

    // Adds plots
    this.initPlots(projectConfig);

    // Adds FITS info if found
    var schema = projectConfig.schema;

    if (!isNull(schema["EVENTS"]) && !isNull(schema["EVENTS"]["HEADER"])) {
      var theInfoPanel = new infoPanel("infoPanel", "EVENTS HEADER:", schema["EVENTS"]["HEADER"], schema["EVENTS"]["HEADER_COMMENTS"]);
      this.$html.append(theInfoPanel.$html);
    } else if (!isNull(schema["RATE"]) && !isNull(schema["RATE"]["HEADER"])) {
      var theInfoPanel = new infoPanel("infoPanel", "LIGHTCURVE HEADER:", schema["RATE"]["HEADER"], schema["RATE"]["HEADER_COMMENTS"]);
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

  this.containsId = function (id) {

    if (this.id == id) {
        return true;
    }

    for (i in this.plots) {
      if (this.plots[i].id == id) {
          return true;
      }
    }

    return false;
  }

  //This applies only while final plots are defined by team
  this.getTxtTablePlots = function ( filename, timeUnit ) {
    return [
                new Plot(
                  this.id + "_time_rate_" + filename,
                  {
                    filename: filename,
                    styles: { type: "2d", labels: ["Time (" + timeUnit  + ")", "Rate"] },
                    axis: [ { table:"txt_table", column:"Time" } ,
                            { table:"txt_table", column:"Rate" } ]
                  },
                  this.service.request_plot_data,
                  this.onFiltersChangedFromPlot,
                  this.onPlotReady,
                  this.$toolBar
                ),

                new Plot(
                  this.id + "_color1_color2_" + filename,
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
                  this.id + "_Time_Rate_Amplitude_" + filename,
                  {
                    filename: filename,
                    styles: { type: "3d", labels: ["Time (" + timeUnit  + ")", "Rate", "Amplitude"] },
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
                  this.id + "_Time_Frecuency_" + filename,
                  {
                    filename: filename,
                    styles: { type: "scatter", labels: ["Time (" + timeUnit  + ")", "Frequency"] },
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

  this.getFitsTablePlots = function ( filename, bck_filename, gti_filename, binSize, timeUnit ) {

    log("getFitsTablePlots: theBinSize: " + binSize );

    return [
                new Plot(
                    this.id + "_ligthcurve_" + filename,
                    {
                      filename: filename,
                      bck_filename: bck_filename,
                      gti_filename: gti_filename,
                      styles: { type: "ligthcurve", labels: ["TIME (" + timeUnit  + ")", "Count Rate(c/s)"] },
                      axis: [ { table: "EVENTS", column:"TIME" },
                              { table: "EVENTS", column:"PI" } ]
                    },
                    this.service.request_lightcurve,
                    this.onFiltersChangedFromPlot,
                    this.onPlotReady,
                    this.$toolBar,
                    "fullWidth"
                  ),

                new Plot(
                    this.id + "_colors_ligthcurve_" + filename,
                    {
                      filename: filename,
                      bck_filename: bck_filename,
                      gti_filename: gti_filename,
                      styles: { type: "colors_ligthcurve", labels: ["TIME (" + timeUnit  + ")", "SCR", "HCR"] },
                      axis: [ { table: "EVENTS", column:"TIME" },
                              { table: "EVENTS", column:"SCR_HCR" } ]
                    },
                    this.service.request_colors_lightcurve,
                    this.onFiltersChangedFromPlot,
                    this.onPlotReady,
                    this.$toolBar,
                    "fullWidth"
                  )

              ];
  }

  this.getLcTablePlots = function ( filename, lcAfilename, lcBfilename, lcCfilename, lcDfilename, binSize, timeUnit ) {

    log("getLcTablePlots: theBinSize: " + binSize );

    return [
              new Plot(
                  this.id + "_ligthcurve_" + filename,
                  {
                    filename: filename,
                    bck_filename: "",
                    gti_filename: "",
                    styles: { type: "ligthcurve", labels: ["TIME (" + timeUnit  + ")", "Count Rate(c/s)"] },
                    axis: [ { table: "RATE", column:"TIME" },
                            { table: "RATE", column:"PI" } ]
                  },
                  this.service.request_lightcurve,
                  this.onFiltersChangedFromPlot,
                  this.onPlotReady,
                  this.$toolBar,
                  "fullWidth"
                ),

                new Plot(
                    this.id + "_ab_divided_ligthcurve_" + filename,
                    {
                      filename: filename,
                      lc0_filename: lcAfilename,
                      lc1_filename: lcBfilename,
                      styles: { type: "ligthcurve", labels: ["TIME (" + timeUnit  + ")", "A/B Count Rate(c/s)"] },
                      axis: [ { table: "RATE", column:"TIME" },
                              { table: "RATE", column:"PI" } ]
                    },
                    this.service.request_divided_lightcurve,
                    this.onFiltersChangedFromPlot,
                    this.onPlotReady,
                    this.$toolBar,
                    ""
                  ),

                  new Plot(
                      this.id + "_cd_divided_ligthcurve_" + filename,
                      {
                        filename: filename,
                        lc0_filename: lcCfilename,
                        lc1_filename: lcDfilename,
                        styles: { type: "ligthcurve", labels: ["TIME (" + timeUnit  + ")", "C/D Count Rate(c/s)"] },
                        axis: [ { table: "RATE", column:"TIME" },
                                { table: "RATE", column:"PI" } ]
                      },
                      this.service.request_divided_lightcurve,
                      this.onFiltersChangedFromPlot,
                      this.onPlotReady,
                      this.$toolBar,
                      ""
                    )

              ];
  }

  log ("Output panel ready!!");
 }
