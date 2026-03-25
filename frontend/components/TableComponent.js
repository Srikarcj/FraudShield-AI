"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function TableComponent({ columns = [], rows = [], emptyMessage = "No records found.", minWidth = "min-w-full md:min-w-[760px]" }) {
  if (!rows.length) {
    return <p className="text-sm text-slate-300">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table className={minWidth}>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.key}>{column.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, rowIndex) => (
            <TableRow key={row.id || row.key || rowIndex}>
              {columns.map((column) => {
                const value = row[column.key];
                return (
                  <TableCell key={`${column.key}-${rowIndex}`}>
                    {typeof column.render === "function" ? column.render(value, row, rowIndex) : value}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
