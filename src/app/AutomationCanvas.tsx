"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { createAutomationRun, saveAutomationRun } from "@/lib/automationRuns";

type AutomationCanvasProps = {
  amount: string;
  assetReady: boolean;
  assetSymbol: string;
  minOut: string;
  rateSourceReady: boolean;
  settlementPair: string;
};

export default function AutomationCanvas({
  amount,
  assetReady,
  assetSymbol,
  minOut,
  rateSourceReady,
  settlementPair,
}: AutomationCanvasProps) {
  const [feedback, setFeedback] = useState("Connect the nodes to create an automation.");
  const initialNodes = useMemo<Node[]>(
    () => [
      {
        id: "settlement",
        position: { x: 28, y: 54 },
        data: { label: `${assetSymbol} settlement\n${amount || "0.0"} locked` },
        type: "input",
      },
      {
        id: "automation",
        position: { x: 330, y: 54 },
        data: { label: `Rate check\n${settlementPair}` },
        type: "output",
      },
    ],
    [amount, assetSymbol, settlementPair],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const connected = edges.some((edge) => edge.source === "settlement" && edge.target === "automation");
  const canRun = connected && assetReady && rateSourceReady;

  useEffect(() => {
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        if (node.id === "settlement") {
          return {
            ...node,
            data: { label: `${assetSymbol} settlement\n${amount || "0.0"} locked` },
          };
        }

        if (node.id === "automation") {
          return {
            ...node,
            data: { label: `Rate check\n${settlementPair}` },
          };
        }

        return node;
      }),
    );
  }, [amount, assetSymbol, setNodes, settlementPair]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source !== "settlement" || connection.target !== "automation") {
        return;
      }

      setEdges((currentEdges) =>
        addEdge(
          {
            ...connection,
            id: "settlement-automation",
            animated: true,
            type: "smoothstep",
          },
          currentEdges.filter((edge) => edge.id !== "settlement-automation"),
        ),
      );
      setFeedback("Automation connected.");
    },
    [setEdges],
  );

  function connectNodes() {
    setEdges([
      {
        id: "settlement-automation",
        source: "settlement",
        target: "automation",
        animated: true,
        type: "smoothstep",
      },
    ]);
    setFeedback("Automation connected.");
  }

  function onRun() {
    if (!canRun) {
      setFeedback(assetReady ? "Add a rate source before running." : "USDC is not configured.");
      return;
    }

    const run = createAutomationRun({
      amount: amount || "0.0",
      assetSymbol,
      minOut: minOut || "0.0",
      settlementPair,
      status: "ready",
    });

    saveAutomationRun(run);
    setFeedback(`Automation saved: ${run.id}`);
  }

  return (
    <section className="panel automation-workbench" aria-labelledby="automation-canvas-head">
      <header className="panel__head automation-workbench__head">
        <h2 id="automation-canvas-head" className="display">
          Automation canvas
        </h2>
        <button type="button" className="cta cta--ghost" onClick={connectNodes}>
          connect
        </button>
      </header>
      <div className="panel__body automation-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
          minZoom={0.7}
          maxZoom={1.4}
          colorMode="dark"
          defaultEdgeOptions={{ animated: true, type: "smoothstep" }}
        >
          <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
        <div className="automation-runbar">
          <span className="label form-feedback">{feedback}</span>
          <button type="button" className="cta" disabled={!connected} onClick={onRun}>
            run automation
          </button>
        </div>
      </div>
    </section>
  );
}
