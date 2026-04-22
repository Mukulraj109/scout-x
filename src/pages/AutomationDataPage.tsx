import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, Typography } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { getAutomationData } from '../api/automation';
import { useGlobalInfoStore } from '../context/globalInfo';

const downloadBlob = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const AutomationDataPage = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { notify } = useGlobalInfoStore();
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(25);
  const [rows, setRows] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [total, setTotal] = useState(0);

  const loadData = async () => {
    try {
      const response = await getAutomationData(id, page + 1, limit);
      setRows(response.rows);
      setColumns(response.columns);
      setTotal(response.pagination.total);
    } catch (error: any) {
      notify('error', error?.response?.data?.error || 'Failed to load automation data');
    }
  };

  useEffect(() => {
    loadData();
  }, [id, page, limit]);

  const flatRows = useMemo(
    () => rows.map((row) => ({ runId: row.runId, source: row.source, createdAt: row.createdAt, ...row.data })),
    [rows]
  );

  const exportJson = () => {
    downloadBlob(JSON.stringify(flatRows, null, 2), `automation-${id}-data.json`, 'application/json');
  };

  const exportCsv = () => {
    const csvColumns = ['runId', 'source', 'createdAt', ...columns];
    const content = [
      csvColumns.join(','),
      ...flatRows.map((row) =>
        csvColumns
          .map((column) => `"${String(row[column] ?? '').replace(/"/g, '""')}"`)
          .join(',')
      ),
    ].join('\n');
    downloadBlob(content, `automation-${id}-data.csv`, 'text/csv;charset=utf-8;');
  };

  return (
    <Box sx={{ p: 4 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2} mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Extracted Data</Typography>
          <Typography variant="body1" color="text.secondary">
            Dynamic table view over the persisted `extracted_data` rows for this automation.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={() => navigate('/dashboard')}>Back</Button>
          <Button variant="outlined" onClick={exportCsv}>Export CSV</Button>
          <Button variant="contained" onClick={exportJson}>Export JSON</Button>
        </Stack>
      </Stack>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Run</TableCell>
              <TableCell>Source</TableCell>
              <TableCell>Created</TableCell>
              {columns.map((column) => (
                <TableCell key={column}>{column}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell>
                  <Button size="small" onClick={() => navigate(`/run/${row.runId}`)}>{row.runId.slice(0, 8)}</Button>
                </TableCell>
                <TableCell>{row.source}</TableCell>
                <TableCell>{row.createdAt}</TableCell>
                {columns.map((column) => (
                  <TableCell key={column}>
                    {typeof row.data?.[column] === 'object'
                      ? JSON.stringify(row.data?.[column])
                      : String(row.data?.[column] ?? '')}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={total}
        page={page}
        onPageChange={(_, nextPage) => setPage(nextPage)}
        rowsPerPage={limit}
        onRowsPerPageChange={(event) => {
          setLimit(parseInt(event.target.value, 10));
          setPage(0);
        }}
      />
    </Box>
  );
};
