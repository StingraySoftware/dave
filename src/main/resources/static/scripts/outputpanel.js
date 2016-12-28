function OutputPanel (classSelector, service) {

  var currentObj = this;

  this.classSelector = classSelector;
  this.$html = $(this.classSelector);
  this.plots = [];

  this.initPlots = function(filename) {
    //PLOTS HARDCODED BY THE MOMENT HERE
    this.plots = [
                new Plot(
                  "time_rate_" + filename,
                  {
                    filename: filename,
                    styles: { type: "2d", labels: ["Time", "Rate"] },
                    axis: [ { table:"txt_table", column:"Time" } ,
                            { table:"txt_table", column:"Rate" } ,
                            { table:"txt_table", column:"Error_time" } ,
                            { table:"txt_table", column:"Error_rate" } ]
                  },
                  service
                ),

                new Plot(
                  "color1_color2_" + filename,
                  {
                    filename: filename,
                    styles: { type: "2d", labels: ["color1", "color2"] },
                    axis: [ { table:"txt_table", column:"color1" } ,
                            { table:"txt_table", column:"color2" } ,
                            { table:"txt_table", column:"Error_color1" } ,
                            { table:"txt_table", column:"Error_color2" } ]
                  },
                  service
                )
              ];

    //ADDS PLOTS TO PANEL
    for (i in this.plots) { this.$html.append(this.plots[i].$html); };
    this.forceResize();
  };

  //METHODS AND EVENTS
  this.resize = function() {
    for (i in this.plots) { this.plots[i].resize(); };
  }
  $(window).resize(this.resize);

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

  log ("Output panel ready!!");
 }
