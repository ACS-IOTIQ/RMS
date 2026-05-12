'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2, Download, Eye, History, MoreVertical, Pencil, Search, Trash2, Upload, UserMinus, UserPlus,
} from 'lucide-react';
import { Topbar } from '@/components/topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PaginationControls, PaginationMeta } from '@/components/ui/pagination';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { formatDate } from '@/lib/utils';

const statusVariant: Record<string, any> = {
  ACTIVE: 'success', ON_LEAVE: 'warning', RESIGNED: 'destructive',
  SUSPENDED: 'destructive', PROBATION: 'secondary', TRAINING: 'secondary', BENCH: 'outline',
};

const emptyForm = {
  employeeCode: '', name: '', email: '', phone: '',
  designationId: '', locationId: '', projectId: '', departmentId: '',
  workforceCategory: 'PRIMARY',
};

const emptyMeta: PaginationMeta = { page: 1, pageSize: 10, total: 0, totalPages: 1 };

function getCell(row: Record<string, any>, names: string[]) {
  const keys = Object.keys(row);
  const wanted = names.map((n) => n.toLowerCase().replace(/[\s_-]/g, ''));
  const key = keys.find((k) => wanted.includes(k.toLowerCase().replace(/[\s_-]/g, '')));
  return key ? String(row[key] ?? '').trim() : '';
}

function matchLookup(items: any[], value: string, fields: string[]) {
  if (!value) return null;
  const needle = value.toLowerCase();
  return items.find((item) => fields.some((field) => String(item[field] ?? '').toLowerCase() === needle)) ?? null;
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>(emptyMeta);
  const [designations, setDesignations] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [allDepartments, setAllDepartments] = useState<any[]>([]);
  const [assignmentDepartments, setAssignmentDepartments] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkValidationOpen, setBulkValidationOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [selected, setSelected] = useState<any>(null);
  const [details, setDetails] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [assignmentForm, setAssignmentForm] = useState({ projectId: '', locationId: '', departmentId: '' });
  const [bulkRows, setBulkRows] = useState<any[]>([]);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [bulkFileName, setBulkFileName] = useState('');
  const [bulkValidated, setBulkValidated] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    if (search) params.set('q', search);
    if (statusFilter) params.set('status', statusFilter);
    const data = await api.get(`/employees?${params.toString()}`);
    if (Array.isArray(data)) {
      setEmployees(data);
      setMeta({ page: 1, pageSize: data.length || pageSize, total: data.length, totalPages: 1 });
    } else {
      setEmployees(data.data ?? []);
      setMeta(data.meta ?? emptyMeta);
    }
  };

  useEffect(() => {
    (async () => {
      const [d, l, p, dept] = await Promise.all([
        api.get('/designations'), api.get('/locations'), api.get('/projects'), api.get('/departments'),
      ]);
      setDesignations(d); setLocations(l); setProjects(p);
      setAllDepartments(dept);
    })();
  }, []);

  useEffect(() => { load(); }, [search, statusFilter, page, pageSize]);

  useEffect(() => {
    if (form.projectId) api.get(`/departments?projectId=${form.projectId}`).then(setDepartments);
    else setDepartments([]);
  }, [form.projectId]);

  useEffect(() => {
    if (assignmentForm.projectId) api.get(`/departments?projectId=${assignmentForm.projectId}`).then(setAssignmentDepartments);
    else setAssignmentDepartments([]);
  }, [assignmentForm.projectId]);

  const filteredFormLocations = useMemo(
    () => locations.filter((l) => !form.projectId || l.projectId === form.projectId),
    [locations, form.projectId],
  );
  const filteredAssignmentLocations = useMemo(
    () => locations.filter((l) => !assignmentForm.projectId || l.projectId === assignmentForm.projectId),
    [locations, assignmentForm.projectId],
  );
  const bulkInvalidRows = useMemo(() => {
    const rows = new Set<number>();
    for (const err of bulkErrors) {
      const row = Number(err.match(/^Row\s+(\d+)/)?.[1]);
      if (Number.isFinite(row)) rows.add(row);
    }
    return rows;
  }, [bulkErrors]);
  const bulkValidRows = Math.max(0, bulkRows.length - bulkInvalidRows.size);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (employee: any) => {
    setEditing(employee);
    setForm({
      employeeCode: employee.employeeCode, name: employee.name, email: employee.email, phone: employee.phone ?? '',
      designationId: employee.designationId, locationId: employee.locationId ?? '', projectId: employee.projectId ?? '',
      departmentId: employee.departmentId ?? '', workforceCategory: employee.workforceCategory ?? 'PRIMARY',
    });
    setOpen(true);
  };

  const loadDetails = async (employee: any, target: 'view' | 'history') => {
    setSelected(employee);
    setDetails(null);
    target === 'view' ? setViewOpen(true) : setHistoryOpen(true);
    setDetails(await api.get(`/employees/${employee.id}`));
  };

  const openAssignment = (employee: any) => {
    setSelected(employee);
    setAssignmentForm({
      projectId: employee.projectId ?? '',
      locationId: employee.locationId ?? '',
      departmentId: employee.departmentId ?? '',
    });
    setAssignmentOpen(true);
  };

  const onSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    try {
      const payload: any = { ...form };
      if (!payload.departmentId) delete payload.departmentId;
      if (!payload.phone) delete payload.phone;
      if (editing) {
        delete payload.employeeCode;
        await api.put(`/employees/${editing.id}`, payload);
        toast('Employee updated', 'success');
      } else {
        await api.post('/employees', payload);
        toast('Employee created', 'success');
      }
      setOpen(false);
      load();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm('Delete this employee?')) return;
    try {
      await api.del(`/employees/${id}`);
      toast('Deleted', 'success');
      load();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  const unassignEmployee = async (employee: any) => {
    if (!confirm(`Unassign ${employee.name} from their current project?`)) return;
    try {
      await api.put(`/employees/${employee.id}/assignment`, { projectId: null });
      toast('Employee unassigned', 'success');
      load();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  const saveAssignment = async () => {
    if (!selected) return;
    try {
      await api.put(`/employees/${selected.id}/assignment`, {
        projectId: assignmentForm.projectId || null,
        locationId: assignmentForm.locationId || null,
        departmentId: assignmentForm.departmentId || null,
      });
      toast('Assignment updated', 'success');
      setAssignmentOpen(false);
      load();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  const downloadTemplate = async () => {
    const XLSX = await import('xlsx');
    const sampleProject = projects[0];
    const sampleLocation = locations.find((l) => l.projectId === sampleProject?.id) ?? locations[0];
    const sampleDesignation = designations[0];
    const sampleDepartment = allDepartments.find((d) => d.projectId === sampleProject?.id) ?? allDepartments[0];
    const workbook = XLSX.utils.book_new();
    const employeeSheet = XLSX.utils.json_to_sheet([
      {
        employeeCode: 'EMP2001',
        name: 'Sample Employee',
        email: 'sample.employee@roster.com',
        phone: '+91-9000000000',
        status: 'ACTIVE',
        workforceCategory: 'PRIMARY',
        project: sampleProject?.code || sampleProject?.name || 'Project name/code/id',
        location: sampleLocation?.name || 'Location name/id',
        designation: sampleDesignation?.name || 'Designation name/id',
        department: sampleDepartment?.name || '',
      },
    ]);
    const instructionSheet = XLSX.utils.aoa_to_sheet([
      ['Column', 'Required', 'Accepted value'],
      ['employeeCode', 'Yes', 'Unique employee code'],
      ['name', 'Yes', 'Employee full name'],
      ['email', 'Yes', 'Unique email address'],
      ['phone', 'No', 'Phone number'],
      ['status', 'No', 'ACTIVE, ON_LEAVE, PROBATION, TRAINING, SUSPENDED, RESIGNED, BENCH'],
      ['workforceCategory', 'No', 'PRIMARY, BACKUP, TRAINEE'],
      ['project', 'Yes', 'Project name, code, or id'],
      ['location', 'Yes', 'Location name or id. Must belong to selected project'],
      ['designation', 'Yes', 'Designation name or id'],
      ['department', 'No', 'Department name or id'],
    ]);
    XLSX.utils.book_append_sheet(workbook, employeeSheet, 'Employees');
    XLSX.utils.book_append_sheet(workbook, instructionSheet, 'Instructions');
    XLSX.writeFile(workbook, 'employee-bulk-upload-template.xlsx');
  };

  const parseBulkFile = async (file: File) => {
    const XLSX = await import('xlsx');
    setBulkFileName(file.name);
    setBulkValidated(false);
    setBulkValidationOpen(false);
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
    const errors: string[] = [];
    if (rows.length === 0) errors.push('File does not contain any employee rows');
    const normalized = rows.map((row, index) => {
      const employeeCode = getCell(row, ['employeeCode', 'employee code', 'code']);
      const name = getCell(row, ['name', 'full name', 'employee name']);
      const email = getCell(row, ['email', 'email address']);
      const phone = getCell(row, ['phone', 'mobile']);
      const status = getCell(row, ['status']) || 'ACTIVE';
      const workforceCategory = getCell(row, ['workforceCategory', 'workforce category', 'category']) || 'PRIMARY';
      const projectValue = getCell(row, ['projectId', 'project id', 'project', 'project code']);
      const locationValue = getCell(row, ['locationId', 'location id', 'location']);
      const designationValue = getCell(row, ['designationId', 'designation id', 'designation']);
      const departmentValue = getCell(row, ['departmentId', 'department id', 'department']);
      const project = matchLookup(projects, projectValue, ['id', 'code', 'name']);
      const location = matchLookup(locations, locationValue, ['id', 'name']);
      const designation = matchLookup(designations, designationValue, ['id', 'name']);
      const department = matchLookup(allDepartments, departmentValue, ['id', 'name']);
      const rowNumber = index + 2;
      const validStatuses = ['ACTIVE','ON_LEAVE','PROBATION','TRAINING','SUSPENDED','RESIGNED','BENCH'];
      const validCategories = ['PRIMARY','BACKUP','TRAINEE'];

      if (!employeeCode) errors.push(`Row ${rowNumber}: employeeCode is required`);
      if (!name) errors.push(`Row ${rowNumber}: name is required`);
      if (!email) errors.push(`Row ${rowNumber}: email is required`);
      if (!project) errors.push(`Row ${rowNumber}: project not found`);
      if (!location) errors.push(`Row ${rowNumber}: location not found`);
      if (!designation) errors.push(`Row ${rowNumber}: designation not found`);
      if (location && project && location.projectId !== project.id) errors.push(`Row ${rowNumber}: location does not belong to project`);
      if (departmentValue && !department) errors.push(`Row ${rowNumber}: department not found`);
      if (department && project && department.projectId !== project.id) errors.push(`Row ${rowNumber}: department does not belong to project`);
      if (status && !validStatuses.includes(status)) errors.push(`Row ${rowNumber}: status must be one of ${validStatuses.join(', ')}`);
      if (workforceCategory && !validCategories.includes(workforceCategory)) errors.push(`Row ${rowNumber}: workforceCategory must be one of ${validCategories.join(', ')}`);

      return {
        employeeCode,
        name,
        email,
        phone,
        status,
        workforceCategory,
        projectId: project?.id,
        locationId: location?.id,
        designationId: designation?.id,
        departmentId: department?.id,
      };
    });
    setBulkRows(normalized);
    setBulkErrors(errors);
  };

  const validateBulk = () => {
    if (bulkRows.length === 0) return toast('Choose a file before validating', 'error');
    setBulkValidated(true);
    setBulkValidationOpen(true);
  };

  const uploadBulk = async () => {
    if (!bulkValidated) return toast('Validate the file before uploading', 'error');
    if (bulkErrors.length > 0) return toast('Fix validation errors before uploading', 'error');
    if (bulkRows.length === 0) return toast('Choose a file first', 'error');
    try {
      const res = await api.post('/employees/bulk', { employees: bulkRows });
      toast(`Created ${res.created} employee(s), ${res.failed} failed`, res.failed ? 'info' : 'success');
      setBulkOpen(false);
      setBulkValidationOpen(false);
      setBulkRows([]);
      setBulkErrors([]);
      setBulkFileName('');
      setBulkValidated(false);
      load();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  return (
    <>
      <Topbar title="Employees" subtitle="Manage workforce roster" />
      <main className="p-4 md:p-6 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 gap-2 max-w-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name, code, email..."
                className="pl-9"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="w-44"
            >
              <option value="">All statuses</option>
              {['ACTIVE','ON_LEAVE','PROBATION','TRAINING','SUSPENDED','RESIGNED','BENCH'].map(s => (
                <option key={s} value={s}>{s.replace('_', ' ')}</option>
              ))}
            </Select>
          </div>
          <div className="flex gap-2">
            <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
              <DialogTrigger asChild>
                <Button variant="outline"><Upload className="h-4 w-4 mr-1.5" />Bulk Upload</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Bulk Employee Upload</DialogTitle>
                  <DialogDescription>Upload CSV, XLS, or XLSX files with employee rows.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 rounded-md border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xs text-muted-foreground">
                      Required columns: employeeCode, name, email, project, location, designation. Optional: phone, department, status.
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
                      <Download className="h-4 w-4 mr-1.5" />Download Template
                    </Button>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Upload File</Label>
                    <Input
                      type="file"
                      accept=".csv,.xls,.xlsx"
                      onChange={(e) => e.target.files?.[0] && parseBulkFile(e.target.files[0])}
                    />
                    {bulkFileName && <div className="text-xs text-muted-foreground">Selected: {bulkFileName}</div>}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-md border p-3">
                      <div className="text-sm font-medium">{bulkRows.length} row(s) parsed</div>
                      <div className="text-xs text-muted-foreground">Run validation before upload.</div>
                    </div>
                    <div className="rounded-md border p-3">
                      <div className="text-sm font-medium">{bulkValidated ? 'Validated' : 'Not validated'}</div>
                      <div className="text-xs text-muted-foreground">{bulkValidated ? `${bulkErrors.length} issue(s) found` : 'Validation pending'}</div>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
                  <Button type="button" variant="outline" onClick={validateBulk} disabled={bulkRows.length === 0}>
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />Validate
                  </Button>
                  <Button type="button" onClick={uploadBulk} disabled={!bulkValidated || bulkErrors.length > 0 || bulkRows.length === 0}>Upload Employees</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={bulkValidationOpen} onOpenChange={setBulkValidationOpen}>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Validate Employee Upload</DialogTitle>
                  <DialogDescription>
                    Review parsed rows and fix any issues before uploading employees.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-md border p-3">
                      <div className="text-xs text-muted-foreground">Total Rows</div>
                      <div className="text-2xl font-semibold">{bulkRows.length}</div>
                    </div>
                    <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                      <div className="text-xs text-emerald-700">Valid Rows</div>
                      <div className="text-2xl font-semibold text-emerald-700">{bulkErrors.length === 0 ? bulkRows.length : bulkValidRows}</div>
                    </div>
                    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                      <div className="text-xs text-destructive">Issues</div>
                      <div className="text-2xl font-semibold text-destructive">{bulkErrors.length}</div>
                    </div>
                  </div>

                  {bulkErrors.length > 0 ? (
                    <div className="max-h-44 overflow-auto rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                      {bulkErrors.map((err) => <div key={err}>{err}</div>)}
                    </div>
                  ) : (
                    <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                      Validation passed. This file is ready to upload.
                    </div>
                  )}

                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee Code</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Mapping</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bulkRows.slice(0, 8).map((row, index) => (
                          <TableRow key={`${row.employeeCode}-${index}`}>
                            <TableCell className="font-mono text-xs">{row.employeeCode || '-'}</TableCell>
                            <TableCell>{row.name || '-'}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{row.email || '-'}</TableCell>
                            <TableCell><Badge variant="outline">{row.status || 'ACTIVE'}</Badge></TableCell>
                            <TableCell className="text-xs">
                              <div>Project: {projects.find((p) => p.id === row.projectId)?.name ?? 'Not found'}</div>
                              <div>Location: {locations.find((l) => l.id === row.locationId)?.name ?? 'Not found'}</div>
                              <div>Designation: {designations.find((d) => d.id === row.designationId)?.name ?? 'Not found'}</div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {bulkRows.length === 0 && (
                          <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No rows parsed.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  {bulkRows.length > 8 && <div className="text-xs text-muted-foreground">Showing first 8 rows of {bulkRows.length}.</div>}
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setBulkValidationOpen(false)}>
                    {bulkErrors.length > 0 ? 'Back to Upload' : 'Continue Editing'}
                  </Button>
                  {bulkErrors.length === 0 && (
                    <Button type="button" onClick={uploadBulk}>Upload Employees</Button>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreate}><UserPlus className="h-4 w-4 mr-1.5" />Add Employee</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editing ? 'Edit Employee' : 'New Employee'}</DialogTitle>
                  <DialogDescription>{editing ? 'Update employee details.' : 'Add a new employee to the workforce.'}</DialogDescription>
                </DialogHeader>
                <form onSubmit={onSubmit} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Employee Code</Label>
                      <Input required disabled={!!editing} value={form.employeeCode}
                        onChange={(e) => setForm({ ...form, employeeCode: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Full Name</Label>
                      <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Email</Label>
                      <Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Phone</Label>
                      <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Project</Label>
                      <Select required value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value, locationId: '', departmentId: '' })}>
                        <option value="">Select project</option>
                        {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Location</Label>
                      <Select required value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })}>
                        <option value="">Select location</option>
                        {filteredFormLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Designation</Label>
                      <Select required value={form.designationId} onChange={(e) => setForm({ ...form, designationId: e.target.value })}>
                        <option value="">Select designation</option>
                        {designations.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Department</Label>
                      <Select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                        <option value="">None</option>
                        {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Workforce Category</Label>
                      <Select value={form.workforceCategory} onChange={(e) => setForm({ ...form, workforceCategory: e.target.value })}>
                        <option value="PRIMARY">Primary</option>
                        <option value="BACKUP">Backup / Reliever</option>
                        <option value="TRAINEE">Trainee</option>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter className="pt-2">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button type="submit">{editing ? 'Save changes' : 'Create'}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">No employees found.</TableCell></TableRow>
                )}
                {employees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell className="font-mono text-xs">{employee.employeeCode}</TableCell>
                    <TableCell>
                      <div className="font-medium">{employee.name}</div>
                      <div className="text-xs text-muted-foreground">{employee.email}</div>
                    </TableCell>
                    <TableCell>{employee.designation?.name}</TableCell>
                    <TableCell>{employee.location?.name ?? <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                    <TableCell>{employee.project?.name ?? <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                    <TableCell><Badge variant={statusVariant[employee.status]}>{employee.status.replace('_', ' ')}</Badge></TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => loadDetails(employee, 'view')}><Eye className="h-4 w-4 mr-2" />View</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(employee)}><Pencil className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openAssignment(employee)}>
                            {employee.projectId ? <UserMinus className="h-4 w-4 mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                            Assign/Unassign
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => loadDetails(employee, 'history')}><History className="h-4 w-4 mr-2" />Shift History</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem disabled>Other future actions</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => onDelete(employee.id)}><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginationControls
              meta={meta}
              onPageChange={setPage}
              onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
            />
          </CardContent>
        </Card>

        <Dialog open={viewOpen} onOpenChange={setViewOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Employee Details</DialogTitle>
              <DialogDescription>Read-only employee profile.</DialogDescription>
            </DialogHeader>
            {details && (
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                {[
                  ['Employee Code', details.employeeCode],
                  ['Name', details.name],
                  ['Email', details.email],
                  ['Phone', details.phone || 'None'],
                  ['Status', details.status],
                  ['Workforce Category', details.workforceCategory ?? 'PRIMARY'],
                  ['Designation', details.designation?.name],
                  ['Project', details.project?.name || 'Unassigned'],
                  ['Location', details.location?.name || 'Unassigned'],
                  ['Department', details.department?.name || 'None'],
                  ['Joined', formatDate(details.joinDate)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="font-medium">{value}</div>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Shift History</DialogTitle>
              <DialogDescription>{selected?.name}</DialogDescription>
            </DialogHeader>
            <div className="max-h-80 overflow-auto rounded-md border">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Shift</TableHead><TableHead>Status</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
                <TableBody>
                  {details?.rosterEntries?.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No shift history.</TableCell></TableRow>}
                  {details?.rosterEntries?.map((entry: any) => (
                    <TableRow key={entry.id}>
                      <TableCell>{formatDate(entry.date)}</TableCell>
                      <TableCell>{entry.shift?.code} - {entry.shift?.name}</TableCell>
                      <TableCell>{entry.status}</TableCell>
                      <TableCell className="text-muted-foreground">{entry.notes || 'None'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={assignmentOpen} onOpenChange={setAssignmentOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign / Unassign Employee</DialogTitle>
              <DialogDescription>{selected?.name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Project</Label>
                <Select value={assignmentForm.projectId} onChange={(e) => setAssignmentForm({ projectId: e.target.value, locationId: '', departmentId: '' })}>
                  <option value="">Unassigned</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Select value={assignmentForm.locationId} onChange={(e) => setAssignmentForm({ ...assignmentForm, locationId: e.target.value })}>
                  <option value="">No location</option>
                  {filteredAssignmentLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Department</Label>
                <Select value={assignmentForm.departmentId} onChange={(e) => setAssignmentForm({ ...assignmentForm, departmentId: e.target.value })}>
                  <option value="">No department</option>
                  {assignmentDepartments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAssignmentOpen(false)}>Cancel</Button>
              <Button type="button" onClick={saveAssignment}>Save Assignment</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </>
  );
}
