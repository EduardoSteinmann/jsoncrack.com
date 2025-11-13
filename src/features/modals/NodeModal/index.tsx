import React from "react";
import type { ModalProps } from "@mantine/core";
import { Modal, Stack, Text, ScrollArea, Flex, CloseButton, Button, Textarea } from "@mantine/core";
import { CodeHighlight } from "@mantine/code-highlight";
import type { NodeData } from "../../../types/graph";
import useGraph from "../../editor/views/GraphView/stores/useGraph";
import useJson from "../../../store/useJson";
import { setValueAtPath } from "../../editor/views/GraphView/lib/setValueAtPath";

// return object from json removing array and object fields
const normalizeNodeData = (nodeRows: NodeData["text"]) => {
  if (!nodeRows || nodeRows.length === 0) return "{}";
  if (nodeRows.length === 1 && !nodeRows[0].key) return `${nodeRows[0].value}`;

  const obj = {};
  nodeRows?.forEach(row => {
    if (row.type !== "array" && row.type !== "object") {
      if (row.key) obj[row.key] = row.value;
    }
  });
  return JSON.stringify(obj, null, 2);
};

// return json path in the format $["customer"]
const jsonPathToString = (path?: NodeData["path"]) => {
  if (!path || path.length === 0) return "$";
  const segments = path.map(seg => (typeof seg === "number" ? seg : `"${seg}"`));
  return `$[${segments.join("][")}]`;
};

export const NodeModal = ({ opened, onClose }: ModalProps) => {
  const nodeData = useGraph(state => state.selectedNode);

  const setJson = useJson(state => state.setJson);
  const [editing, setEditing] = React.useState(false);
  const [editorText, setEditorText] = React.useState("");

  // Reset editing state when a different node is selected
  React.useEffect(() => {
    setEditing(false);
    setEditorText("");
  }, [nodeData?.id]);

  // Clear state when modal is closed
  React.useEffect(() => {
    if (!opened) {
      setEditing(false);
      setEditorText("");
    }
  }, [opened]);

  const startEditing = () => {
    setEditorText(normalizeNodeData(nodeData?.text ?? []));
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setEditorText("");
  };

  const parseEdited = (text: string, nodeRows: NodeData["text"] | undefined) => {
    try {
      return JSON.parse(text);
    } catch (e) {
      // fallback: if single primitive without key, try heuristics
      if (nodeRows && nodeRows.length === 1 && !nodeRows[0].key) {
        const original = nodeRows[0].value;
        if (typeof original === "string") return text;
        if (typeof original === "number") {
          const n = Number(text);
          if (!Number.isNaN(n)) return n;
        }
        if (typeof original === "boolean") {
          const t = text.trim().toLowerCase();
          if (t === "true") return true;
          if (t === "false") return false;
        }
        if (text.trim() === "null") return null;
      }
      throw e;
    }
  };

  const saveEditing = () => {
    try {
      const parsed = parseEdited(editorText, nodeData?.text);
      const prevJson = useJson.getState().getJson();

      // Parse current JSON and locate existing value at the node path
      const rootObj = JSON.parse(prevJson || "null");
      let existingValue: any = rootObj;
      if (nodeData?.path && nodeData.path.length > 0) {
        for (const seg of nodeData.path) {
          if (existingValue == null) break;
          existingValue = existingValue[seg as any];
        }
      }

      // If both existing and parsed are plain objects (not arrays), merge shallowly
      let valueToSet = parsed;
      const isObject = (v: any) => v && typeof v === "object" && !Array.isArray(v);
      if (isObject(existingValue) && isObject(parsed)) {
        valueToSet = { ...existingValue, ...parsed };
      }

      const updated = setValueAtPath(prevJson, nodeData?.path, valueToSet);
      setJson(updated);
      // After updating the global JSON the graph is re-parsed; ensure the
      // selected node in the graph store points to the newly parsed node so
      // the modal content updates to reflect saved changes.
      setTimeout(() => {
        try {
          const nodes = useGraph.getState().nodes;
          const match = nodes.find(n => JSON.stringify(n.path) === JSON.stringify(nodeData?.path));
          if (match) useGraph.getState().setSelectedNode(match);
        } catch (e) {
          // ignore
        }
      }, 0);
      setEditing(false);
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert("Invalid JSON content. Please correct and try again.");
    }
  };

  return (
    <Modal size="auto" opened={opened} onClose={onClose} centered withCloseButton={false}>
      <Stack pb="sm" gap="sm">
        <Stack gap="xs">
          <Flex justify="space-between" align="center">
            <Text fz="xs" fw={500}>
              Content
            </Text>
            <Flex align="center" gap="xs">
              {!editing ? (
                <Button size="xs" variant="outline" onClick={startEditing}>
                  Edit
                </Button>
              ) : (
                <>
                  <Button size="xs" color="gray" variant="subtle" onClick={cancelEditing}>
                    Cancel
                  </Button>
                  <Button size="xs" onClick={saveEditing}>
                    Save
                  </Button>
                </>
              )}
              <CloseButton onClick={onClose} />
            </Flex>
          </Flex>
          <ScrollArea.Autosize mah={250} maw={600}>
            {!editing ? (
              <CodeHighlight
                code={normalizeNodeData(nodeData?.text ?? [])}
                miw={350}
                maw={600}
                language="json"
                withCopyButton
              />
            ) : (
              <Textarea
                value={editorText}
                onChange={e => setEditorText(e.currentTarget.value)}
                minRows={6}
                maw={600}
              />
            )}
          </ScrollArea.Autosize>
        </Stack>
        <Text fz="xs" fw={500}>
          JSON Path
        </Text>
        <ScrollArea.Autosize maw={600}>
          <CodeHighlight
            code={jsonPathToString(nodeData?.path)}
            miw={350}
            mah={250}
            language="json"
            copyLabel="Copy to clipboard"
            copiedLabel="Copied to clipboard"
            withCopyButton
          />
        </ScrollArea.Autosize>
      </Stack>
    </Modal>
  );
};
