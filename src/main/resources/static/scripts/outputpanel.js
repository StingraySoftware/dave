function OutputPanel (classSelector, toolBarSelector, service, onFiltersChangedFromPlotFn) {

  var currentObj = this;

  this.classSelector = classSelector;
  this.toolBarSelector = toolBarSelector;
  this.service = service;
  this.onFiltersChangedFromPlot = onFiltersChangedFromPlotFn;
  this.$html = $(this.classSelector);
  this.$toolBar = $(this.toolBarSelector);
  this.plots = [];

  this.initPlots = function(filename) {
    //PLOTS HARDCODED BY THE MOMENT HERE
    if (!filename.endsWith(".txt")) {
      this.plots = this.getFitsTablePlots(filename);
    } else {
      this.plots = this.getTxtTablePlots(filename);
    }

    //ADDS PLOTS TO PANEL
    this.$html.html("");
    for (i in this.plots) { this.$html.append(this.plots[i].$html); };
    this.forceResize();
  };

  //METHODS AND EVENTS
  this.resize = function() {
    for (i in this.plots) { this.plots[i].resize(); };
  }

  this.forceResize = function () {
    $(window).trigger("resize");
  }

  this.onDatasetChanged = function ( filename ) {
    this.initPlots(filename);
  }

  this.onDatasetValuesChanged = function ( filename, filters ) {
    log("onDatasetValuesChanged:" + filename + ", filters: " + JSON.stringify(filters) );
    for (i in this.plots) { this.plots[i].onDatasetValuesChanged( filename, filters ); };
  }

  //This aplply only while final plots are defined by team
  this.getTxtTablePlots = function ( filename ) {
    return [
                new Plot(
                  "time_rate_" + filename,
                  {
                    filename: filename,
                    styles: { type: "2d", labels: ["Time", "Rate"] },
                    axis: [ { table:"txt_table", column:"Time" } ,
                            { table:"txt_table", column:"Rate" } ]
                  },
                  this.service.request_plot_data,
                  this.onFiltersChangedFromPlot,
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
                  this.$toolBar
                ),

                new Plot(
                  "Time_Rate_Amplitude_" + filename,
                  {
                    filename: filename,
                    styles: { type: "3d", labels: ["Time", "Rate", "Amplitude"] },
                    axis: [ { table:"txt_table", column:"Time" } ,
                            { table:"txt_table", column:"Rate" } ,
                            { table:"txt_table", column:"Amplitude" } ]
                  },
                  this.service.request_plot_data,
                  this.onFiltersChangedFromPlot,
                  this.$toolBar
                ),

                new Plot(
                  "Time_Frecuency_" + filename,
                  {
                    filename: filename,
                    styles: { type: "scatter", labels: ["Time", "Frequency"] },
                    axis: [ { table:"txt_table", column:"Time" } ,
                            { table:"txt_table", column:"Rate" } ]
                  },
                  this.service.request_plot_data,
                  this.onFiltersChangedFromPlot,
                  this.$toolBar
                )
              ];
  }

  this.getFitsTablePlots = function ( filename ) {
    return [
              new Plot(
                "time_pi_" + filename,
                {
                  filename: filename,
                  styles: { type: "scatter", labels: ["TIME", "PI"] },
                  axis: [ { table:"EVENTS", column:"TIME" } ,
                          { table:"EVENTS", column:"PI" } ]
                },
                this.service.request_plot_data,
                this.onFiltersChangedFromPlot,
                this.$toolBar
              ),

              new Plot(
                  "ligthcurve_" + filename,
                  {
                    filename: filename,
                    styles: { type: "ligthcurve", labels: ["TIME", "sumPI"] },
                    axis: [ { table:"EVENTS", column:"TIME" },
                            { table:"EVENTS", column:"PI" } ],
                    dt: 16.0
                  },
                  this.service.request_lightcurve,
                  this.onFiltersChangedFromPlot,
                  this.$toolBar
                )

              ];
  }

  log ("Output panel ready!!");
 }
