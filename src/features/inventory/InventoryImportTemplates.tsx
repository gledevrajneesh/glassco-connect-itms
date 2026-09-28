import { useMemo, useState } from "react";
import { useLocalStore } from "../../lib/localStore";
import {
  specificationColumns,
  specificationsFor,
  type AssetTypeLike,
  type SpecificationField,
} from "./assetSpecifications";

function csvValue(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export default function InventoryImportTemplates() {
  const [types] = useLocalStore<(AssetTypeLike & { status?: string })[]>(
    "itms.asset-types.v1",
    [],
  );
  const [custom] = useLocalStore<SpecificationField[]>(
    "itms.asset-specifications.v1",
    [],
  );
  const [typeId, setTypeId] = useState("");
  const [message, setMessage] = useState("");
  const selected = types.find((type) => type.id === typeId);
  const fields = useMemo(
    () => specificationsFor(selected, custom),
    [selected, custom],
  );
  const headers = [
    "asset_id",
    "receipt_grn",
    "model_code",
    "serial_number",
    "location_code",
    "purchase_date",
    "unit_cost",
    "condition",
    "initial_status",
    ...specificationColumns(fields),
  ];
  function download() {
    if (!selected) return;
    const sample = Object.fromEntries(
      headers.map((header) => [header, "" as string]),
    );
    sample.model_code = "MODEL-CODE";
    sample.condition = "New";
    sample.initial_status = "In stock";
    fields.forEach((field) => {
      sample[`spec_${field.key}`] = field.options[0] ?? "";
    });
    const content = [
      headers.map(csvValue).join(","),
      headers.map((header) => csvValue(sample[header] ?? "")).join(","),
    ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\ufeff", content], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `itms-${selected.code.toLowerCase()}-asset-import-template.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage(
      `${selected.name} template downloaded with ${fields.length} governed specification columns.`,
    );
  }
  return (
    <section className="master-panel import-template-panel">
      <header className="panel-heading">
        <div>
          <span className="eyebrow">CONTROLLED DATA ONBOARDING</span>
          <h2>Category import templates</h2>
          <p>
            Every template is generated from the active Specifications Master.
            Do not edit or add column headers.
          </p>
        </div>
      </header>
      <div className="specification-controls">
        <label>
          Item category
          <select
            value={typeId}
            onChange={(event) => {
              setTypeId(event.target.value);
              setMessage("");
            }}
          >
            <option value="">Select category</option>
            {types
              .filter((type) => type.status === "Active")
              .map((type) => (
                <option key={type.id} value={type.id}>
                  {type.code} · {type.name}
                </option>
              ))}
          </select>
        </label>
        {selected && (
          <button type="button" className="primary-action" onClick={download}>
            Download CSV template
          </button>
        )}
      </div>
      {selected && (
        <section className="import-template-preview">
          <div>
            <strong>{selected.code} import columns</strong>
            <span>
              {headers.length} columns, including {fields.length}{" "}
              category-specific specifications.
            </span>
          </div>
          <p>{headers.join(" · ")}</p>
          <small>
            Required fields:{" "}
            {fields
              .filter((field) => field.required)
              .map((field) => field.name)
              .join(", ") || "None"}
            .
          </small>
        </section>
      )}
      {message && (
        <div className="success-message" role="status">
          ✓ {message}
        </div>
      )}
    </section>
  );
}
