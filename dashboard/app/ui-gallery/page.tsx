"use client";

import { useState } from "react";
import { IconButton } from "@/components/ui/Action";
import { Button, ButtonLink } from "@/components/ui/Button";
import { FileUpload, SelectField, TextArea, TextField } from "@/components/ui/FormControls";
import { Icon, type IconName } from "@/components/ui/Icon";
import { BackLink, FormActions, PageHeader, SegmentedControl, Tabs } from "@/components/ui/Navigation";
import { Badge, Card } from "@/components/ui/Panel";

const iconNames: IconName[] = ["arrow-left", "check", "chevron-down", "chevron-right", "close", "edit", "menu", "search", "sparkle", "upload", "warning"];

export default function PrimitiveGallery() {
  const [view, setView] = useState("list");
  const applyTheme = (next: "light" | "dark") => {
    document.documentElement.setAttribute("data-theme", next);
  };

  return (
    <main className="rf-gallery" data-gallery="rolefit-primitives">
      <div className="rf-gallery__intro">
        <PageHeader
          eyebrow="Phase 1 review fixture"
          title="Rolefit primitive gallery"
          description="Shared interaction, accessibility, density, and theme contracts in one reviewable surface."
          actions={<><Button variant="outline" onClick={() => applyTheme("light")}>Use light theme</Button><Button variant="outline" onClick={() => applyTheme("dark")}>Use dark theme</Button></>}
        />
      </div>
      <div className="rf-gallery__sections">
        <Card as="section" className="rf-gallery__section">
          <h2>Actions</h2>
          <div className="rf-gallery__stack">
            <div className="rf-gallery__row">
              <Button>Primary</Button><Button variant="secondary">Secondary</Button><Button variant="outline">Outline</Button><Button variant="ghost">Ghost</Button><Button variant="destructive">Destructive</Button><Button variant="text-link">Text link</Button>
            </div>
            <div className="rf-gallery__row">
              <Button size="compact">Compact density</Button><Button size="sm">Small</Button><Button size="md">Medium</Button><Button size="lg">Large</Button><Button disabled>Disabled</Button><Button loading loadingLabel="Loading example">Loading</Button>
            </div>
            <div className="rf-gallery__row">
              <ButtonLink href="#navigation" variant="outline">Button link</ButtonLink><IconButton label="Edit example" icon="edit" size="md" /><IconButton label="Close example" icon="close" size="sm" /><IconButton label="Delete example" icon="close" tone="danger" />
            </div>
          </div>
        </Card>

        <Card as="section" className="rf-gallery__section">
          <h2>Icons</h2>
          <div className="rf-gallery__row">{iconNames.map((name) => <span className="rf-gallery__icon" key={name} title={name}><Icon name={name} label={name} /></span>)}</div>
        </Card>

        <Card as="section" className="rf-gallery__section">
          <h2>Fields</h2>
          <div className="rf-gallery__grid">
            <TextField id="gallery-name" label="Full name" description="Visible on generated materials." defaultValue="Alex Morgan" />
            <SelectField id="gallery-level" label="Seniority" defaultValue="senior"><option value="senior">Senior</option><option value="staff">Staff</option></SelectField>
            <TextField id="gallery-error" label="Required example" error="Enter a value." />
            <FileUpload id="gallery-file" label="Résumé" description="PDF or DOCX, up to 10 MB." accept=".pdf,.doc,.docx" />
          </div>
          <div className="rf-gallery__stack"><TextArea id="gallery-summary" label="Professional summary" rows={4} defaultValue="Product-minded engineer focused on useful, durable systems." /></div>
        </Card>

        <section className="rf-gallery__section">
          <h2>Cards and badges</h2>
          <div className="rf-gallery__grid">
            <Card><div className="rf-gallery__row"><Badge>Neutral</Badge><Badge tone="accent">New</Badge><Badge tone="success">Ready</Badge><Badge tone="warning">Review</Badge><Badge tone="danger">Blocked</Badge></div></Card>
            <Card padding="lg"><strong>Elevated card</strong><p>Token-backed border, radius, spacing, surface, and elevation.</p></Card>
          </div>
        </section>

        <Card as="section" className="rf-gallery__section" id="navigation">
          <h2>Navigation</h2>
          <div className="rf-gallery__stack">
            <BackLink href="#">All jobs</BackLink>
            <Tabs label="Gallery sections" items={[{ label: "Overview", href: "#navigation", active: true }, { label: "Details", href: "#details" }, { label: "Unavailable", href: "#disabled", disabled: true }]} />
            <SegmentedControl label="Result view" items={[{ label: "List", value: "list" }, { label: "Board", value: "board", disabled: true }, { label: "Grid", value: "grid" }]} value={view} onChange={setView} />
          </div>
        </Card>

        <Card as="section" className="rf-gallery__section">
          <h2>Page structure</h2>
          <PageHeader title="Job preferences" description="Tell Rolefit which opportunities belong in your queue." actions={<Button variant="outline">Preview</Button>} />
          <FormActions><Button variant="ghost">Cancel</Button><Button>Save changes</Button></FormActions>
        </Card>
      </div>
    </main>
  );
}
