document.addEventListener('DOMContentLoaded', function() {
    const editor = document.getElementById('flowchart-editor');
    const addNodeBtn = document.getElementById('add-node-btn');
    const addConditionBtn = document.getElementById('add-condition-btn');
    const addConnectionBtn = document.getElementById('add-connection-btn');
    const connectionModeIndicator = document.getElementById('connection-mode-indicator');

    let nodes = [];
    let connections = [];
    let selectedNodeId = null;
    let connectionMode = {
        active: false,
        sourceId: null
    };
    let draggedNode = null;
    let dragOffset = { x: 0, y: 0 };

    // Event listeners for keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Skip if we're typing in an input or textarea
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        if (e.key === 'u') {
            addNode('regular');
        } else if (e.key === 'j') {
            addNode('condition');
        } else if (e.key === 'i') {
            if (selectedNodeId) {
                startConnection(selectedNodeId);
            } else {
                alert('Valitse solu mihin yhdistää');
            }
        }
    });

    // Button event listeners
    addNodeBtn.addEventListener('click', () => addNode('regular'));
    addConditionBtn.addEventListener('click', () => addNode('condition'));
    addConnectionBtn.addEventListener('click', () => {
        if (selectedNodeId) {
            startConnection(selectedNodeId);
        }
    });

    // Editor click event (deselect nodes)
    editor.addEventListener('click', function(e) {
        if (e.target === editor) {
            deselectNode();
        }
    });

    // Mouse move and up events for dragging
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', () => {
        draggedNode = null;
    });

    function addNode(type) {
        const id = 'node-' + Date.now();
        const editorRect = editor.getBoundingClientRect();
        
        const node = {
            id,
            type,
            content: '',
            position: {
                x: Math.random() * (editorRect.width - 200) + 50,
                y: Math.random() * (editorRect.height - 200) + 50
            }
        };
        
        nodes.push(node);
        renderNode(node);
        selectNode(id);
    }

    function renderNode(node) {
        const nodeElement = document.createElement('div');
        nodeElement.id = node.id;
        nodeElement.className = `node node-${node.type}`;
        nodeElement.style.left = `${node.position.x}px`;
        nodeElement.style.top = `${node.position.y}px`;
        
        const nodeHeader = document.createElement('div');
        nodeHeader.className = 'node-header';
        
        const nodeType = document.createElement('div');
        nodeType.className = 'node-type';
        nodeType.textContent = node.type === 'condition' ? 'Condition' : 'Node';
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteNode(node.id);
        });
        
        nodeHeader.appendChild(nodeType);
        nodeHeader.appendChild(deleteBtn);
        
        const textarea = document.createElement('textarea');
        textarea.className = 'node-content';
        textarea.value = node.content;
        textarea.rows = 2;
        textarea.placeholder = node.type === 'condition' ? 'Syötä ehto' : 'Kirjoita jotain';
        textarea.addEventListener('input', (e) => {
            updateNodeContent(node.id, e.target.value);
        });
        
        nodeElement.appendChild(nodeHeader);
        nodeElement.appendChild(textarea);
        
        // Add connection points
        const leftPoint = document.createElement('div');
        leftPoint.className = 'connection-point connection-point-left';
        leftPoint.dataset.position = 'left';
        
        const rightPoint = document.createElement('div');
        rightPoint.className = 'connection-point connection-point-right';
        rightPoint.dataset.position = 'right';
        
        nodeElement.appendChild(leftPoint);
        nodeElement.appendChild(rightPoint);
        
        // Mouse events for node
        nodeElement.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; // Only left mouse button
            
            const rect = nodeElement.getBoundingClientRect();
            dragOffset = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
            
            draggedNode = node.id;
            selectNode(node.id);
            
            if (connectionMode.active) {
                completeConnection(node.id);
            }
            
            e.stopPropagation();
        });
        
        nodeElement.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        editor.appendChild(nodeElement);
    }

    function selectNode(id) {
        deselectNode();
        
        selectedNodeId = id;
        const nodeElement = document.getElementById(id);
        if (nodeElement) {
            nodeElement.classList.add('selected');
        }
        
        addConnectionBtn.disabled = false;
    }

    function deselectNode() {
        if (selectedNodeId) {
            const prevSelected = document.getElementById(selectedNodeId);
            if (prevSelected) {
                prevSelected.classList.remove('selected');
            }
        }
        
        selectedNodeId = null;
        addConnectionBtn.disabled = true;
    }

    function updateNodeContent(id, content) {
        const nodeIndex = nodes.findIndex(n => n.id === id);
        if (nodeIndex !== -1) {
            nodes[nodeIndex].content = content;
        }
    }

    function deleteNode(id) {
        // Remove node from array
        nodes = nodes.filter(n => n.id !== id);
        
        // Remove connections to/from this node
        connections = connections.filter(c => c.sourceId !== id && c.targetId !== id);
        
        // Remove node element
        const nodeElement = document.getElementById(id);
        if (nodeElement) {
            nodeElement.remove();
        }
        
        // Remove connection elements
        const connectionElements = document.querySelectorAll(`.connection-${id}`);
        connectionElements.forEach(el => el.remove());
        
        if (selectedNodeId === id) {
            deselectNode();
        }
        
        // Redraw all connections (to clean up)
        redrawConnections();
    }

    function startConnection(nodeId) {
        connectionMode.active = true;
        connectionMode.sourceId = nodeId;
        
        connectionModeIndicator.classList.remove('hidden');
        
        // Add visual indicator to source node
        const sourceNode = document.getElementById(nodeId);
        if (sourceNode) {
            // Add indicators to both left and right connection points
            const leftPoint = sourceNode.querySelector('.connection-point-left');
            const rightPoint = sourceNode.querySelector('.connection-point-right');
            
            if (leftPoint) leftPoint.classList.add('active');
            if (rightPoint) rightPoint.classList.add('active');
        }
    }

    function completeConnection(targetId) {
        if (!connectionMode.sourceId || connectionMode.sourceId === targetId) {
            cancelConnection();
            return;
        }
        
        const connectionId = `conn-${Date.now()}`;
        
        // Get node types to determine connection type
        const sourceNode = nodes.find(n => n.id === connectionMode.sourceId);
        const targetNode = nodes.find(n => n.id === targetId);
        
        if (!sourceNode || !targetNode) {
            cancelConnection();
            return;
        }
        
        // Determine if this is a condition connection
        const isConditionConnection = sourceNode.type === 'condition' || targetNode.type === 'condition';
        
        const newConnection = {
            id: connectionId,
            sourceId: connectionMode.sourceId,
            targetId,
            isConditionConnection,
            label: isConditionConnection ? '' : '' // No label for condition connections by default
        };
        
        connections.push(newConnection);
        drawConnection(newConnection);
        
        cancelConnection();
    }

    function cancelConnection() {
        connectionMode.active = false;
        connectionModeIndicator.classList.add('hidden');
        
        // Remove source indicators
        const activePoints = document.querySelectorAll('.connection-point.active');
        activePoints.forEach(point => point.classList.remove('active'));
        
        connectionMode.sourceId = null;
    }

    function drawConnection(connection) {
        const sourceNode = document.getElementById(connection.sourceId);
        const targetNode = document.getElementById(connection.targetId);
        
        if (!sourceNode || !targetNode) return;
        
        const sourceRect = sourceNode.getBoundingClientRect();
        const targetRect = targetNode.getBoundingClientRect();
        const editorRect = editor.getBoundingClientRect();
        
        // Calculate center points of nodes
        const sourceCenter = {
            x: sourceRect.left - editorRect.left + sourceRect.width / 2,
            y: sourceRect.top - editorRect.top + sourceRect.height / 2
        };
        
        const targetCenter = {
            x: targetRect.left - editorRect.left + targetRect.width / 2,
            y: targetRect.top - editorRect.top + targetRect.height / 2
        };
        
        // Create SVG for the path
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', `connection-line connection-${connection.sourceId} connection-${connection.targetId}`);
        svg.setAttribute('id', `connection-line-${connection.id}`);
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.pointerEvents = 'none';
        
        // Create arrow marker
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        marker.setAttribute('id', `arrowhead-${connection.id}`);
        marker.setAttribute('markerWidth', '10');
        marker.setAttribute('markerHeight', '7');
        marker.setAttribute('refX', '9');
        marker.setAttribute('refY', '3.5');
        marker.setAttribute('orient', 'auto');
        
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
        polygon.setAttribute('fill', connection.isConditionConnection ? '#ff9800' : '#000');
        
        marker.appendChild(polygon);
        defs.appendChild(marker);
        svg.appendChild(defs);
        
        let path, labelX, labelY;
        let shouldHaveLabel = false;
        
        if (connection.isConditionConnection) {
            // Draw diagonal 45-degree connection for condition nodes
            // Determine which sides to connect from
            const sourceIsLeft = sourceCenter.x < targetCenter.x;
            
            // Calculate connection points
            const sourceX = sourceIsLeft ? 
                sourceRect.left - editorRect.left + sourceRect.width : 
                sourceRect.left - editorRect.left;
            
            const sourceY = sourceCenter.y;
            
            const targetX = sourceIsLeft ? 
                targetRect.left - editorRect.left : 
                targetRect.left - editorRect.left + targetRect.width;
            
            const targetY = targetCenter.y;
            
            // Create the diagonal path
            path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`);
            path.setAttribute('stroke', '#ff9800'); // Orange for condition connections
            path.setAttribute('stroke-width', '2');
            path.setAttribute('stroke-dasharray', '5,3'); // Dashed line
            path.setAttribute('fill', 'none');
            path.setAttribute('marker-end', `url(#arrowhead-${connection.id})`);
            
            // No label for condition connections
            shouldHaveLabel = false;
        } else {
            // Draw orthogonal 90-degree connection for regular nodes
            // Determine which sides to connect from
            const sourceIsLeft = sourceCenter.x < targetCenter.x;
            
            // Calculate connection points
            const sourceX = sourceIsLeft ? 
                sourceRect.left - editorRect.left + sourceRect.width : 
                sourceRect.left - editorRect.left;
            
            const sourceY = sourceCenter.y;
            
            const targetX = sourceIsLeft ? 
                targetRect.left - editorRect.left : 
                targetRect.left - editorRect.left + targetRect.width;
            
            const targetY = targetCenter.y;
            
            // Check if nodes are vertically aligned (or nearly aligned)
            const xDifference = Math.abs(sourceCenter.x - targetCenter.x);
            const isVerticallyAligned = xDifference < 20; // Tolerance of 20px
            
            if (isVerticallyAligned) {
                // Create a straight vertical line for aligned nodes
                path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', `M ${sourceCenter.x} ${sourceY} L ${targetCenter.x} ${targetY}`);
                path.setAttribute('stroke', '#000');
                path.setAttribute('stroke-width', '2');
                path.setAttribute('fill', 'none');
                path.setAttribute('marker-end', `url(#arrowhead-${connection.id})`);
                
                // No label for vertically straight connections
                shouldHaveLabel = false;
            } else {
                // Calculate middle X position for the vertical segment
                const middleX = (sourceX + targetX) / 2;
                
                // Create the path with orthogonal segments
                path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                
                // Create path with 90-degree angles
                const d = `M ${sourceX} ${sourceY} 
                           L ${middleX} ${sourceY} 
                           L ${middleX} ${targetY} 
                           L ${targetX} ${targetY}`;
                
                path.setAttribute('d', d);
                path.setAttribute('stroke', '#000');
                path.setAttribute('stroke-width', '2');
                path.setAttribute('fill', 'none');
                path.setAttribute('marker-end', `url(#arrowhead-${connection.id})`);
                
                // Set label position at the middle of the vertical segment
                labelX = middleX;
                labelY = (sourceY + targetY) / 2;
                
                // Only add label for non-straight connections
                shouldHaveLabel = true;
            }
        }
        
        svg.appendChild(path);
        editor.appendChild(svg);
        
        // Only create label for regular connections with 90-degree turns
        if (shouldHaveLabel) {
            const labelContainer = document.createElement('div');
            labelContainer.className = `connection-label connection-${connection.sourceId} connection-${connection.targetId}`;
            labelContainer.id = `connection-label-${connection.id}`;
            labelContainer.style.left = `${labelX}px`;
            labelContainer.style.top = `${labelY}px`;
            labelContainer.style.transform = 'translate(-50%, -50%)';
            
            const labelInput = document.createElement('input');
            labelInput.type = 'text';
            labelInput.value = connection.label || '';
            labelInput.placeholder = 'Label';
            labelInput.addEventListener('input', (e) => {
                updateConnectionLabel(connection.id, e.target.value);
            });
            
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '&times;';
            deleteBtn.addEventListener('click', () => {
                deleteConnection(connection.id);
            });
            
            labelContainer.appendChild(labelInput);
            labelContainer.appendChild(deleteBtn);
            
            labelContainer.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            
            editor.appendChild(labelContainer);
        }
    }

    function updateConnectionLabel(id, label) {
        const connectionIndex = connections.findIndex(c => c.id === id);
        if (connectionIndex !== -1) {
            connections[connectionIndex].label = label;
        }
    }

    function deleteConnection(id) {
        connections = connections.filter(c => c.id !== id);
        
        // Remove connection elements
        const line = document.getElementById(`connection-line-${id}`);
        const label = document.getElementById(`connection-label-${id}`);
        
        if (line) line.remove();
        if (label) label.remove();
    }

    function redrawConnections() {
        // Remove all connection elements
        const connectionLines = document.querySelectorAll('.connection-line');
        const connectionLabels = document.querySelectorAll('.connection-label');
        
        connectionLines.forEach(el => el.remove());
        connectionLabels.forEach(el => el.remove());
        
        // Redraw all connections
        connections.forEach(conn => {
            drawConnection(conn);
        });
    }

    function handleMouseMove(e) {
        if (!draggedNode) return;
        
        const nodeElement = document.getElementById(draggedNode);
        if (!nodeElement) return;
        
        const editorRect = editor.getBoundingClientRect();
        const x = e.clientX - editorRect.left - dragOffset.x;
        const y = e.clientY - editorRect.top - dragOffset.y;
        
        // Update node position in the array
        const nodeIndex = nodes.findIndex(n => n.id === draggedNode);
        if (nodeIndex !== -1) {
            nodes[nodeIndex].position = { x, y };
        }
        
        // Update node position in the DOM
        nodeElement.style.left = `${x}px`;
        nodeElement.style.top = `${y}px`;
        
        // Redraw connections
        redrawConnections();
    }
});