"use client";

import { useCallback, useEffect, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  Position,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { AgentNode } from "./AgentNode";
import { TaskNode } from "./TaskNode";

type Task = {
  _id: string;
  title: string;
  status: string;
  assignedAgentId: string;
  dependencies: string[];
  description: string;
};

type Agent = {
  _id: string;
  name: string;
  avatar: string;
  role: string;
};

type DirectiveData = {
  _id: string;
  title: string;
  status: string;
};

const nodeTypes = {
  agentNode: AgentNode,
  taskNode: TaskNode,
};

export function AgentMap({
  directive,
  tasks,
  agents,
  logs,
}: {
  directive: DirectiveData;
  tasks: Task[] | undefined;
  agents: Agent[] | undefined;
  logs: any[] | undefined;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[]);

  // Build the DAG from tasks
  useEffect(() => {
    if (!tasks || !agents) return;

    const agentMap = new Map(agents.map((a) => [a._id, a]));
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    // Get the latest log per task for activity text
    const taskLogs = new Map<string, string>();
    if (logs) {
      for (const log of logs) {
        try {
          const payload = JSON.parse(log.payload);
          if (payload.taskId && !taskLogs.has(payload.taskId)) {
            taskLogs.set(payload.taskId, payload.transition ?? payload.resultPreview?.slice(0, 80) ?? log.eventType);
          }
        } catch {}
      }
    }

    // Directive root node
    newNodes.push({
      id: "directive",
      type: "taskNode",
      position: { x: 300, y: 0 },
      data: {
        label: directive.title,
        status: directive.status,
        isDirective: true,
        activity: directive.status === "in_progress" ? "Swarm processing..." : directive.status,
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    });

    // Layout: simple grid
    const cols = Math.min(tasks.length, 3);
    const colWidth = 290;
    const rowHeight = 170;

    tasks.forEach((task, i) => {
      const agent = agentMap.get(task.assignedAgentId);
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * colWidth + (cols === 1 ? 300 : (cols === 2 ? 200 : 100));
      const y = (row + 1) * rowHeight + 40;

      newNodes.push({
        id: task._id,
        type: "taskNode",
        position: { x, y },
        data: {
          label: task.title,
          status: task.status,
          agentName: agent?.name ?? "Unknown",
          agentAvatar: agent?.avatar ?? "🤖",
          activity: taskLogs.get(task._id) ?? "",
          isDirective: false,
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      });

      const isCompleted = task.status === "completed";
      const isInProgress = task.status === "in_progress" || task.status === "queued" || task.status === "pending_spec";
      
      const edgeColor = isCompleted 
        ? "#10b981" 
        : isInProgress 
        ? "#3b82f6" 
        : "rgba(9, 9, 11, 0.08)";

      // Edge from directive to root tasks (no dependencies)
      if (task.dependencies.length === 0) {
        newEdges.push({
          id: `directive-${task._id}`,
          source: "directive",
          target: task._id,
          animated: task.status === "in_progress" || task.status === "queued",
          style: {
            stroke: edgeColor,
            strokeWidth: isInProgress ? 2 : 1.5,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: edgeColor,
          },
        });
      }

      // Edges from dependencies
      for (const depId of task.dependencies) {
        newEdges.push({
          id: `${depId}-${task._id}`,
          source: depId,
          target: task._id,
          animated: task.status === "in_progress" || task.status === "queued",
          style: {
            stroke: edgeColor,
            strokeWidth: isInProgress ? 2 : 1.5,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: edgeColor,
          },
        });
      }
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [tasks, agents, directive, logs, setNodes, setEdges]);

  return (
    <div className="flex-1 w-full animate-fade-in relative z-10">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3, maxZoom: 1.1 }}
        minZoom={0.3}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
      >
        <Background gap={20} size={1} color="rgba(9, 9, 11, 0.04)" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
