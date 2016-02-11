// set up SVG for D3
var width  = 900,
    height = 600,
    colors = d3.scale.category10();
    nodeRadius = 20;  

var svg = d3.select('body')
  .append('svg')
  .attr('oncontextmenu', 'return false;')
  .attr('width', width)
  .attr('height', height);

// set up initial nodes and links
//  - nodes are known by 'id', not by index in array.
//  - reflexive edges are indicated on the node (as a bold black circle).
//  - links are always source < target; edge directions are set by 'left' and 'right'.
var nodes = [],
  lastNodeId = 0,
  lastPathId = 0,
  links = [];

// for Dijkstra
var s;

// visual
var sColor = 'Peru',
    beforeColor = 'LightSteelBlue',
    afterColor = 'SteelBlue';

// init D3 force layout
var charge = -50,
    chargeDistance = 50,
    gravity = 0,
    friction = 0.95;

var force = d3.layout.force()
    .nodes(nodes)
    .links(links)
    .size([width, height])
    .charge(charge)
    .chargeDistance(chargeDistance)
    .gravity(gravity)
    .friction(friction)
    .linkStrength(0)
    .on('tick', tick);

// line displayed when dragging new nodes
var drag_line = svg.append('svg:path')
  .attr('class', 'link dragline hidden')
  .attr('d', 'M0,0L0,0');

// handles to link and node element groups
var path = svg.append('svg:g').selectAll('path'), //hopefully it'll be the path element
    circle = svg.append('svg:g').selectAll('circle');
var pathForTick; //hopefully it'll be the group element that encompasses a path element and its label.

// mouse event vars
var selected_node = null,
    selected_link = null,
    mousedown_link = null,
    mousedown_node = null,
    mouseup_node = null;

function resetMouseVars() {
  mousedown_node = null;
  mouseup_node = null;
  mousedown_link = null;
}

// update force layout (called automatically each iteration)
function tick() {
  pathForTick.attr('d', function(d) {
    var deltaX = d.target.x - d.source.x,
        deltaY = d.target.y - d.source.y,
        dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY),
        normX = deltaX / dist,
        normY = deltaY / dist,
	sourcePadding = 0,
        targetPadding = 0,
        sourceX = d.source.x + (sourcePadding * normX),
        sourceY = d.source.y + (sourcePadding * normY),
        targetX = d.target.x - (targetPadding * normX),
        targetY = d.target.y - (targetPadding * normY);
    return 'M' + sourceX + ',' + sourceY + 'L' + targetX + ',' + targetY;
  });

  circle.attr('transform', function(d) {
    return 'translate(' + d.x + ',' + d.y + ')';
  });
}

// update graph (called when needed)
function restart() {
  path = path.data(links);

  // update existing links
  path.classed('selected', function(d) { return d === selected_link; });

  // add new links
  var pathGroup = path.enter().append('svg:g').attr('class', 'path');
	  
  pathForTick = pathGroup.append('path')
	  .attr('class', 'link')
	  .attr('id', function(d) { return (d.id).toString(); })
	  .classed('selected', function(d) { return d === selected_link; })
	  .on('mousedown', function(d) {
              if(d3.event.ctrlKey) return;

	      // select link
	      mousedown_link = d;
	      if(mousedown_link === selected_link) selected_link = null;
      	      else selected_link = mousedown_link;
                  selected_node = null;
                  restart();
           }); 

  pathGroup.append('svg:text')
	  .attr('class', 'pathText')
	  .attr('dy', -5)
	  .append('textPath')
	  .attr('xlink:href', function(d) { return '#'+(d.id).toString(); })
	  .attr('startOffset', '50%')
	  .text(function(d) { return d.length; });

  // remove old links
  path.exit().remove();


  // circle (node) group
  // NB: the function arg is crucial here! nodes are known by id, not by index!
  circle = circle.data(nodes, function(d) { return d.id; });

  // update existing nodes (reflexive & selected visual states)
  circle.selectAll('circle')
    .style('fill', function(d) {
      if(d.id === s) { return sColor; }
      return beforeColor;
    })
    .classed('reflexive', function(d) { return d.reflexive; });

  // add new nodes
  var g = circle.enter().append('svg:g').attr('class', 'circle');

  g.append('svg:circle')
    .attr('class', 'node')
    .attr('class', function(d) { return 'c'+d.id.toString(); })
    .attr('r', nodeRadius)
    .style('fill', beforeColor)
    .classed('reflexive', function(d) { return d.reflexive; })
    .on('mouseover', function(d) {
      if(!mousedown_node || d === mousedown_node) return;
      // enlarge target node
      d3.select(this).attr('transform', 'scale(1.1)');
    })
    .on('mouseout', function(d) {
      if(!mousedown_node || d === mousedown_node) return;
      // unenlarge target node
      d3.select(this).attr('transform', '');
    })
    .on('mousedown', function(d) {
      // select node
      mousedown_node = d;
      if(mousedown_node === selected_node) selected_node = null;
      else selected_node = mousedown_node;
      selected_link = null;

      // reposition drag line
      drag_line
        .style('marker-end', 'url(#end-arrow)')
        .classed('hidden', false)
        .attr('d', 'M' + mousedown_node.x + ',' + mousedown_node.y + 'L' + mousedown_node.x + ',' + mousedown_node.y);

      restart();
    })
    .on('mouseup', function(d) {
      if(!mousedown_node) return;

      // needed by FF
      drag_line
        .classed('hidden', true)
        .style('marker-end', '');

      // check for drag-to-self
      mouseup_node = d;
      if(mouseup_node === mousedown_node) { resetMouseVars(); return; }

      // add link to graph (update if exists)
      // NB: links are strictly source < target; arrows separately specified by booleans
      var source, target, direction;
      if(mousedown_node.id < mouseup_node.id) {
        source = mousedown_node;
        target = mouseup_node;
        direction = 'right';
      } else {
        source = mouseup_node;
        target = mousedown_node;
        direction = 'left';
      }

      var link;
      var dx = source.x - target.x;
      var dy = source.y - target.y;
      var linkLength = Math.sqrt(dx*dx + dy*dy)/10;

      link = links.filter(function(l) {
        return (l.source === source && l.target === target);
      })[0];

      if(link) {
        link[direction] = true;
	link.length = Math.floor(linkLength);
      } else {
        link = {source: source, target: target, left: false, right: false};
        link[direction] = true;
	link.length = Math.floor(linkLength);
	++lastPathId;
	link.id = lastPathId;
        links.push(link);
      }


      // select new link
      selected_link = link;
      selected_node = null;
      restart();
    });

  // show node IDs
  g.append('svg:text')
      .attr('x', 0)
      .attr('y', 4)
      .attr('class', 'id')
      .attr('class', function(d) { return 't'+d. id.toString(); });
      //.text(function(d) { return d.id; });

  // remove old nodes
  circle.exit().remove();

  // set the graph in motion
  force.start();
}

function mousedown() {
  // prevent I-bar on drag

  // because :active only works in WebKit?
  svg.classed('active', true);

  if(d3.event.ctrlKey) {
    s = mousedown_node.id;
    restart();
    return;
  }

  if(mousedown_node || mousedown_link) return;

  // insert new node at point
  circle = circle.data(nodes, function(d){
	  d.fixed = true;
	  return d.id;
  });

  var point = d3.mouse(this),
      node = {id: ++lastNodeId, reflexive: false};
  node.x = point[0];
  node.y = point[1];
  nodes.push(node);

  restart();
}

function mousemove() {
  if(!mousedown_node) return;

  // update drag line
  drag_line.attr('d', 'M' + mousedown_node.x + ',' + mousedown_node.y + 'L' + d3.mouse(this)[0] + ',' + d3.mouse(this)[1]);

  restart();
}

function mouseup() {
  if(mousedown_node) {
    // hide drag line
    drag_line
      .classed('hidden', true)
      .style('marker-end', '');
  }

  // because :active only works in WebKit?
  svg.classed('active', false);

  // clear mouse event vars
  resetMouseVars();
}

function spliceLinksForNode(node) {
  var toSplice = links.filter(function(l) {
    return (l.source === node || l.target === node);
  });
  toSplice.map(function(l) {
    links.splice(links.indexOf(l), 1);
  });
}

function keydown() {
  if(d3.event.keyCode === 13 && s) {
    dijkstra();
  }
}

function keyup() {}

function dijkstra() {

  var nestSource = d3.nest()
	  .key(function(d) { return d.source.id; })
	  .rollup(function(g) { 
	    return {
	      edges: g.map( function(e) {
	        return { target: e.target.id, length: e.length };
	      })
	    }; 
	  })
          .map(links);

  var nestTarget = d3.nest()
	  .key(function(d) { return d.target.id; })
	  .rollup(function(g) { 
	    return {
	      edges: g.map( function(e) {
	        return { target: e.source.id, length: e.length };
	      })
	    }; 
	  })
          .map(links);

  var thisNode;
  var thisId; 
  var queue = nodes.map(function(node) {
	  thisId = node.id;
	  
	  var edgeTo = nestSource[thisId] ? nestSource[thisId].edges : [],
              edgeFrom = nestTarget[thisId] ? nestTarget[thisId].edges : [],
              edgeAll = edgeTo.concat(edgeFrom);

          var dist = (thisId === s) ? 0 : Infinity,
              prev = null;
          
          var newNode = {}; 
  	return {id: thisId, edges: edgeAll, dist: dist, prev: prev};
  });

  var alt, u, v, e, newText, newColor;
  var delay = 0,
      duration = 1000;
  while (queue.length > 0){
    queue.sort(function(a, b){ return Math.sign(b.dist - a.dist); }); // min dist at tail
    u = queue.pop();
    newText = (u.dist === Infinity) ? '' : u.dist.toString();
    newColor = (u.id === s) ? sColor : ((u.dist === Infinity) ? beforeColor : afterColor)

    // animation
    svg.selectAll('.t'+u.id.toString())
            .transition()
	    .duration(duration)
	    .delay(delay)
	    .style('text-anchor', 'middle')
	    .style('font-weight', 'bold')
	    .text(newText);
    svg.selectAll('.c'+u.id.toString())
	    .transition()
	    .duration(duration)
	    .delay(delay)
	    .style('fill', newColor);
    delay += 1500;

    for (var i = 0; i < u.edges.length; i++) {
      e = u.edges[i];
      v = queue.find(function(element, index, array){ return element.id === e.target });
      alt = u.dist + e.length;

      if (v && alt < v.dist) {
        v.dist = alt;
	v.prev = u;
      }// end of if
    }// end of for

  }// end of while

  console.log('Dijkstra done');

}// end of dijkstra

// app starts here
svg.on('mousedown', mousedown)
  .on('mousemove', mousemove)
  .on('mouseup', mouseup);
d3.select(window)
  .on('keydown', keydown)
  .on('keyup', keyup);
restart();
