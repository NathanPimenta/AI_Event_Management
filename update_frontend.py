import re

with open("Planify-main/app/ai-tools/report-generator/page.tsx", "r") as f:
    content = f.read()

# 1. State definitions
state_addition = """    const [eventDate, setEventDate] = useState("")
    const [eventTime, setEventTime] = useState("")
    const [eventVenue, setEventVenue] = useState("")
    const [targetAudience, setTargetAudience] = useState("")
    const [dbitStudentsCount, setDbitStudentsCount] = useState("")
    const [nonDbitStudentsCount, setNonDbitStudentsCount] = useState("")
    const [resourcePersonName, setResourcePersonName] = useState("")
    const [resourcePersonOrg, setResourcePersonOrg] = useState("")
    const [organizingBody, setOrganizingBody] = useState("")
    const [facultyCoordinator, setFacultyCoordinator] = useState("")
    const [facebookLink, setFacebookLink] = useState("")
    const [instagramLink, setInstagramLink] = useState("")
    const [linkedinLink, setLinkedinLink] = useState("")
    const [approver1Name, setApprover1Name] = useState("")
    const [approver1Post, setApprover1Post] = useState("")
    const [approver2Name, setApprover2Name] = useState("")
    const [approver2Post, setApprover2Post] = useState("")
    const [preparer1Name, setPreparer1Name] = useState("")
    const [preparer1Post, setPreparer1Post] = useState("")
    const [preparer2Name, setPreparer2Name] = useState("")
    const [preparer2Post, setPreparer2Post] = useState("")
    const [objective1, setObjective1] = useState("")
    const [objective2, setObjective2] = useState("")
    const [objective3, setObjective3] = useState("")
    const [outcome1, setOutcome1] = useState("")
    const [outcome2, setOutcome2] = useState("")
    const [outcome3, setOutcome3] = useState("")
    const [detailedDescription, setDetailedDescription] = useState("")

    // File states"""

content = content.replace("    // File states", state_addition)
content = content.replace("    const [templateFileName, setTemplateFileName] = useState(\"\")\n", "")
content = content.replace("    // Custom template toggle\n    const [useCustomTemplate, setUseCustomTemplate] = useState(false)\n", "")

content = content.replace("    const templateRef = useRef<HTMLInputElement>(null)\n", "")
content = content.replace("        const templateFile = templateRef.current?.files?.[0]\n", "")

upload_custom_template = """            // Upload optional Overleaf template
            if (useCustomTemplate && templateFile) {
                const templateFormData = new FormData()
                templateFormData.append("file", templateFile)
                // Determine literal filename for upload based on extension
                const endpoint = templateFile.name.endsWith(".docx")
                    ? "http://127.0.0.1:8003/upload/custom_template.docx"
                    : "http://127.0.0.1:8003/upload/custom_template.tex"

                await fetch(endpoint, {
                    method: "POST",
                    body: templateFormData,
                })
            }"""

content = content.replace(upload_custom_template, "")

payload_code = """
            const payload = {
                event_name: eventName,
                event_type: eventType,
                department_name: institutionName,
                event_title: eventName,
                event_date: eventDate,
                event_time: eventTime,
                event_venue: eventVenue,
                target_audience: targetAudience,
                dbit_students_count: dbitStudentsCount,
                non_dbit_students_count: nonDbitStudentsCount,
                resource_person_name: resourcePersonName,
                resource_person_org: resourcePersonOrg,
                organizing_body: organizingBody,
                faculty_coordinator: facultyCoordinator,
                objective_1: objective1,
                objective_2: objective2,
                objective_3: objective3,
                outcome_1: outcome1,
                outcome_2: outcome2,
                outcome_3: outcome3,
                detailed_description: detailedDescription,
                facebook_link: facebookLink,
                instagram_link: instagramLink,
                linkedin_link: linkedinLink,
                approver_1_name: approver1Name,
                approver_1_post: approver1Post,
                approver_2_name: approver2Name,
                approver_2_post: approver2Post,
                preparer_1_name: preparer1Name,
                preparer_1_post: preparer1Post,
                preparer_2_name: preparer2Name,
                preparer_2_post: preparer2Post,
            }
"""

old_generate = """            // Generate report
            const response = await fetch("http://127.0.0.1:8003/generate-report", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    event_name: eventName,
                    event_type: eventType,
                    institution_name: institutionName,
                    use_custom_template: useCustomTemplate && !!templateFile,
                }),
            })"""

new_generate = "            // Generate report" + payload_code + """            const response = await fetch("http://127.0.0.1:8003/generate-report", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })"""

content = content.replace(old_generate, new_generate)

old_retry_generate = """            // After uploading all assets, try to generate the report again
            const response = await fetch("http://127.0.0.1:8003/generate-report", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    event_name: eventName,
                    event_type: eventType,
                    institution_name: institutionName,
                    use_custom_template: useCustomTemplate && !!templateRef.current?.files?.[0],
                }),
            })"""

new_retry_generate = "            // After uploading all assets, try to generate the report again\n" + payload_code + """            const response = await fetch("http://127.0.0.1:8003/generate-report", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })"""

content = content.replace(old_retry_generate, new_retry_generate)

# UI additions
extra_ui = """
                            <div className="grid gap-4 md:grid-cols-3 mt-4">
                                <div className="space-y-2">
                                    <Label htmlFor="eventDate">Event Date</Label>
                                    <Input id="eventDate" value={eventDate} onChange={(e) => setEventDate(e.target.value)} placeholder="e.g. 24th Oct 2024" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="eventTime">Event Time</Label>
                                    <Input id="eventTime" value={eventTime} onChange={(e) => setEventTime(e.target.value)} placeholder="e.g. 10:00 AM - 4:00 PM" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="eventVenue">Event Venue</Label>
                                    <Input id="eventVenue" value={eventVenue} onChange={(e) => setEventVenue(e.target.value)} placeholder="e.g. Main Auditorium" />
                                </div>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2 mt-4">
                                <div className="space-y-2">
                                    <Label htmlFor="targetAudience">Target Audience</Label>
                                    <Input id="targetAudience" value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} placeholder="e.g. TE IT & Comps" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="organizingBody">Organizing Body</Label>
                                    <Input id="organizingBody" value={organizingBody} onChange={(e) => setOrganizingBody(e.target.value)} placeholder="e.g. ACM Student Chapter" />
                                </div>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2 mt-4">
                                <div className="space-y-2">
                                    <Label htmlFor="dbitStudentsCount">DBIT Students Count</Label>
                                    <Input id="dbitStudentsCount" value={dbitStudentsCount} onChange={(e) => setDbitStudentsCount(e.target.value)} placeholder="e.g. 50" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="nonDbitStudentsCount">Non-DBIT Students Count</Label>
                                    <Input id="nonDbitStudentsCount" value={nonDbitStudentsCount} onChange={(e) => setNonDbitStudentsCount(e.target.value)} placeholder="e.g. 10" />
                                </div>
                            </div>
                            <div className="grid gap-4 md:grid-cols-3 mt-4">
                                <div className="space-y-2">
                                    <Label htmlFor="resourcePersonName">Resource Person Name</Label>
                                    <Input id="resourcePersonName" value={resourcePersonName} onChange={(e) => setResourcePersonName(e.target.value)} placeholder="e.g. Mr. John Doe" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="resourcePersonOrg">Resource Person Org</Label>
                                    <Input id="resourcePersonOrg" value={resourcePersonOrg} onChange={(e) => setResourcePersonOrg(e.target.value)} placeholder="e.g. Google" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="facultyCoordinator">Faculty Coordinator</Label>
                                    <Input id="facultyCoordinator" value={facultyCoordinator} onChange={(e) => setFacultyCoordinator(e.target.value)} placeholder="e.g. Prof. Smith" />
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-3 mt-4">
                                <div className="space-y-2">
                                    <Label htmlFor="objective1">Objective 1</Label>
                                    <Input id="objective1" value={objective1} onChange={(e) => setObjective1(e.target.value)} placeholder="" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="objective2">Objective 2</Label>
                                    <Input id="objective2" value={objective2} onChange={(e) => setObjective2(e.target.value)} placeholder="" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="objective3">Objective 3</Label>
                                    <Input id="objective3" value={objective3} onChange={(e) => setObjective3(e.target.value)} placeholder="" />
                                </div>
                            </div>
                            
                            <div className="grid gap-4 md:grid-cols-3 mt-4">
                                <div className="space-y-2">
                                    <Label htmlFor="outcome1">Outcome 1</Label>
                                    <Input id="outcome1" value={outcome1} onChange={(e) => setOutcome1(e.target.value)} placeholder="" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="outcome2">Outcome 2</Label>
                                    <Input id="outcome2" value={outcome2} onChange={(e) => setOutcome2(e.target.value)} placeholder="" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="outcome3">Outcome 3</Label>
                                    <Input id="outcome3" value={outcome3} onChange={(e) => setOutcome3(e.target.value)} placeholder="" />
                                </div>
                            </div>

                            <div className="space-y-2 mt-4">
                                <Label htmlFor="detailedDescription">Detailed Description Pointers</Label>
                                <Input id="detailedDescription" value={detailedDescription} onChange={(e) => setDetailedDescription(e.target.value)} placeholder="Provide pointers. The AI will write the paragraph." />
                            </div>

                            <div className="grid gap-4 md:grid-cols-3 mt-4">
                                <div className="space-y-2">
                                    <Label htmlFor="facebookLink">Facebook Link</Label>
                                    <Input id="facebookLink" value={facebookLink} onChange={(e) => setFacebookLink(e.target.value)} placeholder="Link or N/A" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="instagramLink">Instagram Link</Label>
                                    <Input id="instagramLink" value={instagramLink} onChange={(e) => setInstagramLink(e.target.value)} placeholder="Link or N/A" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="linkedinLink">LinkedIn Link</Label>
                                    <Input id="linkedinLink" value={linkedinLink} onChange={(e) => setLinkedinLink(e.target.value)} placeholder="Link or N/A" />
                                </div>
                            </div>
                            
                            <div className="grid gap-4 md:grid-cols-2 mt-4">
                                <div className="space-y-2">
                                    <Label>Approver 1 Detail</Label>
                                    <Input className="mb-2" value={approver1Name} onChange={(e) => setApprover1Name(e.target.value)} placeholder="Name (e.g. Dr. Phadke)" />
                                    <Input value={approver1Post} onChange={(e) => setApprover1Post(e.target.value)} placeholder="Post (e.g. Principal)" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Approver 2 Detail</Label>
                                    <Input className="mb-2" value={approver2Name} onChange={(e) => setApprover2Name(e.target.value)} placeholder="Name" />
                                    <Input value={approver2Post} onChange={(e) => setApprover2Post(e.target.value)} placeholder="Post" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Preparer 1 Detail</Label>
                                    <Input className="mb-2" value={preparer1Name} onChange={(e) => setPreparer1Name(e.target.value)} placeholder="Name" />
                                    <Input value={preparer1Post} onChange={(e) => setPreparer1Post(e.target.value)} placeholder="Post" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Preparer 2 Detail</Label>
                                    <Input className="mb-2" value={preparer2Name} onChange={(e) => setPreparer2Name(e.target.value)} placeholder="Name" />
                                    <Input value={preparer2Post} onChange={(e) => setPreparer2Post(e.target.value)} placeholder="Post" />
                                </div>
                            </div>
"""

content = content.replace("                            </div>\n                        </CardContent>\n                    </Card>\n\n                    {/* Step 2: Upload Data */}", "                            </div>\n" + extra_ui + "                        </CardContent>\n                    </Card>\n\n                    {/* Step 2: Upload Data */}")


custom_template_start = "                            {/* Custom Overleaf Template (Optional) */}"
custom_template_end = "                                </CollapsibleContent>\n                            </Collapsible>\n                        </CardContent>"

if custom_template_start in content and custom_template_end in content:
    # We want to remove the collapsible wrapper but keep the contents (Logo and include images sections)
    
    # Let's cleanly replace the collapsible tags
    content = content.replace("<Collapsible open={useCustomTemplate} onOpenChange={setUseCustomTemplate}>", "")
    content = content.replace("</CollapsibleTrigger>", "")
    collapsible_trigger = """<CollapsibleTrigger asChild>
                                    <Button variant="outline" type="button" className="w-full justify-between">
                                        <span className="flex items-center gap-2">
                                            <FileCode className="h-4 w-4" />
                                            Custom Template (Optional)
                                        </span>
                                        <ChevronDown className={`h-4 w-4 transition-transform ${useCustomTemplate ? "rotate-180" : ""}`} />
                                    </Button>"""
    content = content.replace(collapsible_trigger, "")
    
    content = content.replace('<CollapsibleContent className="mt-4">', "<div>")
    content = content.replace("</CollapsibleContent>\n                            </Collapsible>", "</div>")
    content = content.replace("{/* Custom Overleaf Template (Optional) */}", "{/* Additional Images Options */}")
    
    # Remove the .tex/.docx custom template upload completely (lines 610-634 roughly)
    template_upload_start = '<p className="text-sm text-muted-foreground">'
    template_upload_end = '</span>\n                                        </div>'
    if template_upload_start in content and template_upload_end in content:
        start_idx = content.index(template_upload_start)
        # Find the SECOND occurrence of template_upload_end starting from start_idx
        # because the first one might be shorter. 
        # Actually it's easier to use regex or string replace for the whole block:
        block_to_remove = """<p className="text-sm text-muted-foreground">
                                            Upload a custom Overleaf/LaTeX template (.tex) or Word Document (.docx) to customize the report format.
                                            The template should include placeholders (e.g., {"{{event_name}}"}) that will be filled by the AI.
                                        </p>
                                        <div
                                            className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors ${templateFileName ? "border-green-500" : "border-muted"}
                                                `}
                                            onClick={() => templateRef.current?.click()}
                                        >
                                            <input
                                                type="file"
                                                ref={templateRef}
                                                className="hidden"
                                                accept=".tex,.docx"
                                                onChange={(e) => handleFileChange(e, setTemplateFileName)}
                                            />
                                            <FileCode className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                                            <span className="text-sm">
                                                {templateFileName || "Click to upload .tex or .docx template"}
                                            </span>
                                        </div>"""
        import re
        content = re.sub(r'<p className="text-sm text-muted-foreground">.*?<div\s+className={`border-2.*?<span className="text-sm">.*?</span>\s+</div>', '', content, flags=re.DOTALL)

with open("Planify-main/app/ai-tools/report-generator/page.tsx", "w") as f:
    f.write(content)
