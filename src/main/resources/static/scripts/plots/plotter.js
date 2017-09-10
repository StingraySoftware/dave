
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
                  error_x : getErrorConfig(x_error_values),
                  error_y : getErrorConfig(y_error_values)
                }
              ],
        layout : {
                   title: !isNull(title) ? title : '',
                   hovermode: 'closest',
                   xaxis: getLabelConfig(x_label),
                   yaxis: getLabelConfig(y_label),
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
                  error_x : getErrorConfig(x_error_values),
                  error_y : getErrorConfig(y_error_values),
                  line : {
                          shape	:	'hvh',
                          color : '#1f77b4'
                        }
                }
              ],
        layout : {
                   title: !isNull(title) ? title : '',
                   hovermode: 'closest',
                   xaxis: getLabelConfig(x_label),
                   yaxis: getLabelConfig(y_label),
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
                  error_x : getErrorConfig(x_error_values),
                  error_y : getErrorConfig(y_error_values),
                  error_z : getErrorConfig(z_error_values),
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
                   title: !isNull(title) ? title : '',
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
      layout : getDefaultLayout (title, x_label, y_label)
    }
}

function get_plotdiv_scatter_with_errors(x_values, y_values, x_error_values, y_error_values, x_label, y_label, title) {
  var plotdiv = get_plotdiv_scatter(x_values, y_values, x_label, y_label, title);
  plotdiv.data[0].error_x = getErrorConfig(x_error_values);
  plotdiv.data[0].error_y = getErrorConfig(y_error_values);
  return plotdiv;
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
      layout : getDefaultLayout (title, x_label, y_label)
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
                 title: !isNull(title) ? title : '',
                 hovermode: 'closest',
                 xaxis: getLabelConfig(x_label),
                 yaxis: getLabelConfig(y_label),
                 scene: {
                   xaxis: getLabelConfig(x_label),
                   yaxis: getLabelConfig(y_label),
                   zaxis: getLabelConfig(z_label)
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
                  error_x : getErrorConfig(x_error_values),
                  error_y : getErrorConfig(y0_error_values),
                  name: y0_label
                },
                {
                  type : 'scatter',
                  hoverinfo : 'none',
                  showlegend : false,
                  x : x_values,
                  y : y1_values,
                  error_x : getErrorConfig(x_error_values),
                  error_y : getErrorConfig(y1_error_values),
                  name: y1_label
                }
              ],
        layout : {
                   title: !isNull(title) ? title : '',
                   hovermode: 'closest',
                   xaxis: getLabelConfig(x_label),
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

function getConfidenceShape (y_range) {
  return {
          type: 'rect',
          xref: 'paper',
          yref: 'y',
          x0: 0,
          y0: y_range[0],
          x1: 1,
          y1: y_range[1],
          fillcolor: '#265a88',
          opacity: 0.2,
          line: {
              width: 0
          }
      };
}

function getDefaultLayout (title, x_label, y_label) {
  return {
             title: !isNull(title) ? title : '',
             hovermode: 'closest',
             xaxis: getLabelConfig(x_label),
             yaxis: getLabelConfig(y_label),
             margin: DEFAULT_MARGINS
          };
}

function getLabelConfig (label){
  return { title : label, titlefont : DEFAULT_TITLE_FONT };
}

function getLine (xdata, ydata, color){
  return {
          type : 'scatter',
          showlegend : false,
          hoverinfo : 'none',
          connectgaps : false,
          x : xdata,
          y : ydata,
          line : {
                  color : color
                }
        };
}

function getCrossLine (xrange, yrange, color, width, style, opacity){
  return { visible: !isNull(color),
           x: xrange,
           y: yrange,
           mode:"lines",
           showlegend: false,
           line: {
                  dash: isNull(style) ? 'solid' : style,
                  width: isNull(width) ? 1 : width,
                  color: isNull(color) ? '#dd4814' : color,
                  width: isNull(opacity) ? 1 : opacity
                },
           hoverinfo: "none" };
}

function getErrorConfig(error_data) {
  return {
           type : 'data',
           array : error_data,
           visible : true,
           opacity: ERROR_BAR_OPACITY
        };
}

function getAgnPlotTrace(yaxis, xData, yData, yErrorData) {
  var plotTrace = {
          type : 'scatter',
          mode : "markers",
          showlegend : false,
          hoverinfo : 'x+y',
          x : xData,
          y : yData,
          error_y : getErrorConfig(yErrorData)
        };

  if (!isNull(yaxis)) {
    plotTrace.yaxis = yaxis;
  }

  return plotTrace;
}

function getAgnPlotTraceWithXErrorData(yaxis, xData, yData, xErrorData, yErrorData) {
  var plotTrace = getAgnPlotTrace(yaxis, xData, yData, yErrorData);
  plotTrace.error_x = getErrorConfig(xErrorData);
  return plotTrace;
}
