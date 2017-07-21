
var DEFAULT_TITLE_FONT = {
            family : 'Courier New, monospace',
            size : 18,
            color : '#7f7f7f'
          };

var DEFAULT_MARGINS = { b : 38, r : 12, l: 64, t: 30 }

var ERROR_BAR_OPACITY = 0.2;

function get_plotdiv_xy(x_values, y_values, x_error_values, y_error_values, wti_x_ranges, x_label, y_label, title){

    return {
        data: [
                {
                  type : 'scatter',
                  showlegend : false,
                  hoverinfo : 'none',
                  x : x_values,
                  y : y_values,
                  error_x : {
                             type : 'data',
                             array : x_error_values,
                             visible : true,
                             opacity: ERROR_BAR_OPACITY
                          },
                  error_y : {
                             type : 'data',
                             array : y_error_values,
                             visible : true,
                             opacity: ERROR_BAR_OPACITY
                          }
                }
              ],
        layout : {
                   title : !isNull(title) ? title : '',
                   hovermode: 'closest',
                   xaxis : {
                             title : x_label,
                             titlefont : DEFAULT_TITLE_FONT
                           },
                   yaxis: {
                             title : y_label,
                             titlefont : DEFAULT_TITLE_FONT
                         },
                  dragmode:'select',
                  margin: DEFAULT_MARGINS,
                  shapes: getShapesFromWti (wti_x_ranges)
                }
        }
}

function get_plotdiv_lightcurve(x_values, y_values, x_error_values, y_error_values, wti_x_ranges, x_label, y_label, title){

    return {
        data: [
                {
                  type : 'scatter',
                  showlegend : false,
                  hoverinfo : 'none',
                  connectgaps : false,
                  x : x_values,
                  y : y_values,
                  error_x : {
                             type : 'data',
                             array : x_error_values,
                             visible : true,
                             opacity: ERROR_BAR_OPACITY
                          },
                  error_y : {
                             type : 'data',
                             array : y_error_values,
                             visible : true,
                             opacity: ERROR_BAR_OPACITY
                          },
                  line : {
                          shape	:	'hvh',
                          color : '#1f77b4'
                        }
                }
              ],
        layout : {
                   title : !isNull(title) ? title : '',
                   hovermode: 'closest',
                   xaxis : {
                             title : x_label,
                             titlefont : DEFAULT_TITLE_FONT
                           },
                   yaxis: {
                             title : y_label,
                             titlefont : DEFAULT_TITLE_FONT
                         },
                  dragmode:'select',
                  margin: DEFAULT_MARGINS,
                  shapes: getShapesFromWti (wti_x_ranges)
                }
        }
}

function get_plotdiv_xyz(x_values, y_values, z_values, x_error_values, y_error_values, z_error_values, title, color_label, color_array){

    return {
        data: [
                {
                  type : 'scatter3d',
                  x : x_values,
                  y : y_values,
                  z : z_values,
                  error_x : {
                             type : 'data',
                             array : x_error_values,
                             visible : true,
                             opacity: ERROR_BAR_OPACITY
                          },
                  error_y : {
                             type : 'data',
                             array : y_error_values,
                             visible : true,
                             opacity: ERROR_BAR_OPACITY
                          },
                  error_z : {
                             type : 'data',
                             array : z_error_values,
                             visible : true,
                             opacity: ERROR_BAR_OPACITY
                          },
                  marker : {
                            size : 5,
                            color : color_array,  // set color to an array/list of desired values
                            colorscale : 'Viridis', // choose a colorscale
                            colorbar : {
                                      title : color_label,
                                      thickness : 20,
                                      len : 1
                                    },
                            opacity : 0.8
                          }
                }
              ],
        layout : {
                   title : !isNull(title) ? title : '',
                   margin: DEFAULT_MARGINS
                }
        }
}

function get_plotdiv_scatter(x_values, y_values, x_label, y_label, title) {

  return {
      data: [
              {
                type : 'scatter',
                showlegend : false,
                x : x_values,
                y : y_values,
                mode : "markers",
                marker : {
                      size : 6,
                      opacity : 0.8
                    }
              }
            ],
      layout : {
                 title : !isNull(title) ? title : '',
                 hovermode: 'closest',
                 xaxis : {
                           title : x_label,
                           titlefont : DEFAULT_TITLE_FONT
                         },
                 yaxis: {
                           title : y_label,
                           titlefont : DEFAULT_TITLE_FONT
                       },
                 margin: DEFAULT_MARGINS
              }
      }
}

function get_plotdiv_scatter_colored(x_values, y_values, color_array, x_label, y_label, color_label, title) {

  return {
      data: [
              {
                type : 'scatter',
                x : x_values,
                y : y_values,
                mode : "markers",
                marker : {
                      size : 6,
                      color : color_array,  // set color to an array/list of desired values
                      colorscale : 'Viridis', // choose a colorscale
                      colorbar : {
                                title : color_label,
                                thickness : 20,
                                len : 1
                              },
                      opacity : 0.8
                    }
              }
            ],
      layout : {
                 title : !isNull(title) ? title : '',
                 hovermode: 'closest',
                 xaxis : {
                           title : x_label,
                           titlefont : DEFAULT_TITLE_FONT
                         },
                 yaxis: {
                           title : y_label,
                           titlefont : DEFAULT_TITLE_FONT
                       },
                 margin: DEFAULT_MARGINS
              }
      }

}

function get_plotdiv_dynamical_spectrum(x_values, y_values, z_values, x_label, y_label, z_label, colorscale, title) {

  return {
      data: [
              {
                type : 'surface',
                x : x_values,
                y : y_values,
                z : z_values,
                colorscale: colorscale
              }
            ],
      layout : {
                 title : !isNull(title) ? title : '',
                 hovermode: 'closest',
                 scene: {
                   xaxis : {
                             title : x_label,
                             titlefont : DEFAULT_TITLE_FONT
                           },
                   yaxis: {
                             title : y_label,
                             titlefont : DEFAULT_TITLE_FONT
                         },
                   zaxis: {
                             title : z_label,
                             titlefont : DEFAULT_TITLE_FONT
                       }
              		},
                 margin: DEFAULT_MARGINS
              }
      }
}

function get_plotdiv_xyy(x_values, y0_values, y1_values,
                          x_error_values, y0_error_values, y1_error_values,
                          wti_x_ranges, x_label, y0_label, y1_label, title){

    return {
        data: [
                {
                  type : 'scatter',
                  showlegend : false,
                  hoverinfo : 'none',
                  x : x_values,
                  y : y0_values,
                  error_x : {
                             type : 'data',
                             array : x_error_values,
                             visible : true,
                             opacity: ERROR_BAR_OPACITY
                          },
                  error_y : {
                             type : 'data',
                             array : y0_error_values,
                             visible : true,
                             opacity: ERROR_BAR_OPACITY
                          },
                  name: y0_label
                },
                {
                  type : 'scatter',
                  hoverinfo : 'none',
                  showlegend : false,
                  x : x_values,
                  y : y1_values,
                  error_x : {
                             type : 'data',
                             array : x_error_values,
                             visible : true
                          },
                  error_y : {
                             type : 'data',
                             array : y1_error_values,
                             visible : true
                          },
                  name: y1_label
                }
              ],
        layout : {
                   title : !isNull(title) ? title : '',
                   hovermode: 'closest',
                   xaxis : {
                             title : x_label,
                             titlefont : DEFAULT_TITLE_FONT
                           },
                  dragmode:'select',
                  margin: DEFAULT_MARGINS,
                  shapes: getShapesFromWti (wti_x_ranges)
                }
        }
}

//Return the ploty shapes for higlight the WRONG TIME INTERVALS
function getShapesFromWti (wti_x_ranges) {
  var wti_shapes = [];

  for (i in wti_x_ranges) {
    var wti_range = wti_x_ranges[i];
    var wti_shape = {
                      type: 'rect',
                      // x-reference is assigned to the x-values
                      xref: 'x',
                      // y-reference is assigned to the plot paper [0,1]
                      yref: 'paper',
                      x0: wti_range[0],
                      y0: 0,
                      x1: wti_range[1],
                      y1: 1,
                      fillcolor: '#dd4814',
                      opacity: 0.1,
                      line: {
                          width: 0
                      }
                  };
    wti_shapes.push(wti_shape);
  }

  return wti_shapes;
}

function getCrossLine (xrange, yrange){
  return { visible: false,
           x: xrange,
           y: yrange,
           mode:"lines",
           showlegend: false,
           line: {
                  width: 1,
                  color: '#dd4814'
                },
           hoverinfo: "none" };
}
