import React, { useState, useMemo } from 'react';
import { FinancialRecord, TransactionAuditLog, AppUser } from '../types';
import { formatDate, formatRupiah } from '../utils/formatters';
import {
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  Plus,
  Search,
  Edit3,
  Trash2,
  History,
  AlertTriangle,
  FileText,
  ShieldAlert,
  CheckCircle2,
  Clock,
  UserCheck,
  Calendar,
  Layers,
  RotateCcw,
  Radio,
  Eye,
  Landmark,
  CreditCard,
  X,
} from 'lucide-react';

interface FinanceManagerProps {
  finances: FinancialRecord[];
  onAddFinanceRecord: (record: FinancialRecord) => void;
  onUpdateFinanceRecord?: (record: FinancialRecord) => void;
  onDeleteFinanceRecord?: (id: string, reason: string, user: string) => void;
  onRestoreFinanceRecord?: (id: string, reason: string, user: string) => void;
  onPermanentDeleteFinanceRecord?: (id: string, user: string) => void;
  currentUser?: AppUser | null;
}

export const FinanceManager: React.FC<FinanceManagerProps> = ({
  finances,
  onAddFinanceRecord,
  onUpdateFinanceRecord,
  onDeleteFinanceRecord,
  onRestoreFinanceRecord,
  onPermanentDeleteFinanceRecord,
  currentUser,
}) => {
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('active');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Modals for Detail, Edit, Delete, Permanent Delete & Audit History
  const [detailRecord, setDetailRecord] = useState<FinancialRecord | null>(null);
  const activeDetailRecord = useMemo(
    () => (detailRecord ? finances.find((f) => f.id === detailRecord.id) || null : null),
    [detailRecord, finances]
  );

  const [editingRecord, setEditingRecord] = useState<FinancialRecord | null>(null);
  const [editReason, setEditReason] = useState<string>('');

  const [deletingRecord, setDeletingRecord] = useState<FinancialRecord | null>(null);
  const [deleteReason, setDeleteReason] = useState<string>('');

  const [permanentDeletingRecord, setPermanentDeletingRecord] = useState<FinancialRecord | null>(null);

  const [auditRecord, setAuditRecord] = useState<FinancialRecord | null>(null);
  const activeAuditRecord = useMemo(
    () => (auditRecord ? finances.find((f) => f.id === auditRecord.id) || null : null),
    [auditRecord, finances]
  );

  // New Record Form State
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState(5000000);
  const [type, setType] = useState<'income' | 'expense'>('income');
  const [category, setCategory] = useState<FinancialRecord['category']>('dp_pembayaran');
  const [projectName, setProjectName] = useState('Grand Yusuf Residence');
  const [unitCode, setUnitCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Transfer Bank');
  const [sourceBank, setSourceBank] = useState<string>('Bank BCA');
  const [senderBankName, setSenderBankName] = useState<string>('Bank BCA');
  const [senderAccountNumber, setSenderAccountNumber] = useState<string>('');
  const [destinationBank, setDestinationBank] = useState<string>('Bank BCA');
  const [destinationBankCustom, setDestinationBankCustom] = useState<string>('');
  const [destinationAccountNumber, setDestinationAccountNumber] = useState<string>('');
  const [destinationAccountName, setDestinationAccountName] = useState<string>('');
  const [payerName, setPayerName] = useState('');
  const [payerRelationship, setPayerRelationship] = useState('Konsumen Langsung (Pribadi)');
  const [recipientRelationship, setRecipientRelationship] = useState('Rekening Perusahaan (PT Yusuf Property)');
  const [transactionNotes, setTransactionNotes] = useState('');

  // Backdate options for New Record Form
  const [isBackdate, setIsBackdate] = useState<boolean>(false);
  const [backdateDate, setBackdateDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [backdateReason, setBackdateReason] = useState<string>('');

  const CATEGORY_LABELS: Record<FinancialRecord['category'], string> = {
    booking_fee: 'Booking Fee / UTJ',
    dp_pembayaran: 'Pembayaran Uang Muka (DP)',
    pencairan_kpr: 'Pencairan KPR Bank',
    material_konstruksi: 'Pembelian Material Konstruksi',
    gaji_mandor: 'Upah Mandor & Pekerja',
    legal_sertifikat: 'Legalitas & Sertifikat',
    pemasaran: 'Biaya Pemasaran / Komisi',
    lainnya: 'Operasional / Lainnya',
  };

  // Active (non-deleted) records for calculation
  const activeFinances = useMemo(() => finances.filter((f) => !f.isDeleted), [finances]);

  // Unique month keys in dataset (e.g. ['2026-07', '2026-06', ...])
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    const nowKey = new Date().toISOString().slice(0, 7);
    monthSet.add(nowKey);
    finances.forEach((f) => {
      if (f.date && f.date.length >= 7) {
        monthSet.add(f.date.slice(0, 7));
      }
    });
    return Array.from(monthSet).sort((a, b) => b.localeCompare(a));
  }, [finances]);

  const formatMonthLabel = (mKey: string) => {
    if (mKey === 'all') return 'Semua Periode Transaksi';
    const [year, month] = mKey.split('-');
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const monthIdx = parseInt(month, 10) - 1;
    return `${monthNames[monthIdx] || month} ${year}`;
  };

  // Saldo Awal Bulan (Balance of all active records before start of selectedMonthKey)
  const saldoAwalBulan = useMemo(() => {
    if (selectedMonthKey === 'all') return 0;
    const startOfMonth = `${selectedMonthKey}-01`;
    return activeFinances
      .filter((f) => f.date < startOfMonth)
      .reduce((acc, curr) => acc + (curr.type === 'income' ? curr.amount : -curr.amount), 0);
  }, [activeFinances, selectedMonthKey]);

  // Active records for current month filter
  const currentMonthFinances = useMemo(() => {
    if (selectedMonthKey === 'all') {
      return [...activeFinances].sort((a, b) => a.date.localeCompare(b.date));
    }
    return activeFinances
      .filter((f) => f.date.startsWith(selectedMonthKey))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [activeFinances, selectedMonthKey]);

  // Monthly totals
  const totalIncomeMonth = useMemo(() => {
    return currentMonthFinances
      .filter((f) => f.type === 'income')
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [currentMonthFinances]);

  const totalExpenseMonth = useMemo(() => {
    return currentMonthFinances
      .filter((f) => f.type === 'expense')
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [currentMonthFinances]);

  // Saldo Akhir Bulan Ini (Will become Saldo Awal next month)
  const saldoAkhirBulan = saldoAwalBulan + totalIncomeMonth - totalExpenseMonth;

  // Overall total net balance
  const totalIncomeAll = activeFinances
    .filter((f) => f.type === 'income')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalExpenseAll = activeFinances
    .filter((f) => f.type === 'expense')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const netBalanceAll = totalIncomeAll - totalExpenseAll;

  // Running balance calculation for display table (chronological order)
  const displayFinancesWithRunningBalance = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = (f: FinancialRecord) => {
      if (!q) return true;
      return [
        f.title,
        f.refNumber,
        f.projectName,
        f.unitCode,
        f.payerName,
        f.payerRelationship,
        f.senderBankName,
        f.sourceBank,
        f.senderAccountNumber,
        f.destinationBank,
        f.destinationAccountNumber,
        f.destinationAccountName,
        f.recipientRelationship,
        f.recordedBy,
      ]
        .filter(Boolean)
        .some((val) => String(val).toLowerCase().includes(q));
    };

    if (filterType === 'deleted') {
      return finances
        .filter((f) => f.isDeleted && matchesSearch(f))
        .map((f) => ({ record: f, runningBalance: 0 }));
    }

    let baseList = currentMonthFinances;
    if (filterType === 'income') {
      baseList = baseList.filter((f) => f.type === 'income');
    } else if (filterType === 'expense') {
      baseList = baseList.filter((f) => f.type === 'expense');
    }

    let running = saldoAwalBulan;
    const withRunning = baseList.map((f) => {
      if (f.type === 'income') {
        running += f.amount;
      } else {
        running -= f.amount;
      }
      return {
        record: f,
        runningBalance: running,
      };
    });

    return q ? withRunning.filter(({ record }) => matchesSearch(record)) : withRunning;
  }, [currentMonthFinances, filterType, finances, saldoAwalBulan, searchQuery]);

  // Handle create new record
  const handleSubmitNewRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || amount <= 0) return;

    const recordedBy = currentUser?.name || 'Admin Keuangan Yusuf Property';
    const nowStr = new Date().toLocaleString('id-ID');
    const finalDate = isBackdate ? backdateDate : new Date().toISOString().split('T')[0];

    const resolvedBankLabel = senderBankName.trim() || sourceBank;
    const resolvedPaymentMethod =
      sourceBank === 'Cash / Tunai' || paymentMethod === 'Cash / Tunai'
        ? 'Cash / Tunai'
        : `${paymentMethod}${resolvedBankLabel && resolvedBankLabel !== 'Lainnya' ? ` - ${resolvedBankLabel}` : ''}`;

    const resolvedDestinationBank =
      destinationBank === 'Lainnya' ? destinationBankCustom.trim() : destinationBank;

    const bankSummaryParts: string[] = [];
    if (resolvedBankLabel || payerName.trim() || senderAccountNumber.trim()) {
      bankSummaryParts.push(
        `Pengirim: ${payerName.trim() || '-'} (${resolvedBankLabel || '-'}${senderAccountNumber.trim() ? ` - ${senderAccountNumber.trim()}` : ''})`
      );
    }
    if (resolvedDestinationBank || destinationAccountNumber.trim() || destinationAccountName.trim()) {
      const destBankPrefix = resolvedDestinationBank ? `${resolvedDestinationBank} ` : '';
      bankSummaryParts.push(
        `Penerima: ${destinationAccountName.trim() || '-'} (${destBankPrefix}${destinationAccountNumber.trim() || '-'})`
      );
    }

    const initialAuditLog: TransactionAuditLog = {
      id: `log-${Date.now()}`,
      timestamp: nowStr,
      action: 'CREATE',
      user: recordedBy,
      reason: isBackdate ? `Pencatatan Backdate (${finalDate}): ${backdateReason || 'Entri transaksi tanggal mundur'}` : 'Pencatatan awal transaksi kas baru',
      changesSummary: `Penambahan transaksi nominal ${formatRupiah(amount)}${bankSummaryParts.length > 0 ? ` [${bankSummaryParts.join(' | ')}]` : ''}${isBackdate ? ` [BACKDATE: ${finalDate}]` : ''}`,
      isBackdate: isBackdate,
      backdateDate: isBackdate ? finalDate : undefined,
      backdateReason: isBackdate ? backdateReason : undefined,
    };

    const newRecord: FinancialRecord = {
      id: `fin-${Date.now()}`,
      date: finalDate,
      type,
      category,
      title,
      amount,
      projectName,
      unitCode: unitCode.trim() || undefined,
      paymentMethod: resolvedPaymentMethod,
      sourceBank: sourceBank || undefined,
      senderBankName: senderBankName.trim() || undefined,
      senderAccountNumber: senderAccountNumber.trim() || undefined,
      destinationBank: resolvedDestinationBank || undefined,
      destinationAccountNumber: destinationAccountNumber.trim() || undefined,
      destinationAccountName: destinationAccountName.trim() || undefined,
      payerName: payerName.trim() || undefined,
      payerRelationship,
      recipientRelationship: recipientRelationship.trim() || undefined,
      transactionNotes: transactionNotes.trim() || undefined,
      refNumber: `TRF/YP/${Date.now().toString().slice(-4)}`,
      recordedBy,
      isBackdate,
      backdateDate: isBackdate ? finalDate : undefined,
      backdateReason: isBackdate ? backdateReason.trim() : undefined,
      auditLogs: [initialAuditLog],
    };

    onAddFinanceRecord(newRecord);
    setShowAddModal(false);
    setTitle('');
    setUnitCode('');
    setPaymentMethod('Transfer Bank');
    setSourceBank('Bank BCA');
    setSenderBankName('Bank BCA');
    setSenderAccountNumber('');
    setDestinationBank('Bank BCA');
    setDestinationBankCustom('');
    setDestinationAccountNumber('');
    setDestinationAccountName('');
    setPayerName('');
    setPayerRelationship('Konsumen Langsung (Pribadi)');
    setRecipientRelationship('Rekening Perusahaan (PT Yusuf Property)');
    setTransactionNotes('');
    setIsBackdate(false);
    setBackdateReason('');
  };

  // Open Edit Modal
  const handleOpenEdit = (rec: FinancialRecord) => {
    setEditingRecord({
      ...rec,
      isBackdate: rec.isBackdate || false,
      backdateDate: rec.backdateDate || rec.date,
      backdateReason: rec.backdateReason || '',
    });
    setEditReason('');
  };

  // Save Edit Record
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord || !editReason.trim()) return;

    const userName = currentUser?.name || 'Admin Keuangan Yusuf Property';
    const nowStr = new Date().toLocaleString('id-ID');

    // Find original
    const original = finances.find((f) => f.id === editingRecord.id);
    let summaryText = 'Pembaruan data transaksi';
    const dateChanged = original && original.date !== editingRecord.date;
    const backdateNotice = editingRecord.isBackdate ? ` [BACKDATE: ${editingRecord.date}]` : '';

    if (original && original.amount !== editingRecord.amount) {
      summaryText = `Nominal diubah dari ${formatRupiah(original.amount)} menjadi ${formatRupiah(editingRecord.amount)}${backdateNotice}`;
    } else if (dateChanged) {
      summaryText = `Tanggal transaksi diubah dari ${original.date} menjadi ${editingRecord.date}${backdateNotice}`;
    } else if (original && original.title !== editingRecord.title) {
      summaryText = `Keterangan diubah dari "${original.title}" menjadi "${editingRecord.title}"${backdateNotice}`;
    } else if (
      original &&
      (original.sourceBank !== editingRecord.sourceBank ||
        original.senderBankName !== editingRecord.senderBankName ||
        original.senderAccountNumber !== editingRecord.senderAccountNumber ||
        original.payerName !== editingRecord.payerName ||
        original.payerRelationship !== editingRecord.payerRelationship ||
        original.destinationBank !== editingRecord.destinationBank ||
        original.destinationAccountNumber !== editingRecord.destinationAccountNumber ||
        original.destinationAccountName !== editingRecord.destinationAccountName ||
        original.recipientRelationship !== editingRecord.recipientRelationship)
    ) {
      summaryText = `Informasi pengirim / penerima dana transaksi diperbarui${backdateNotice}`;
    } else if (editingRecord.isBackdate) {
      summaryText = `Pembaruan data & status backdate (${editingRecord.date})`;
    }

    const newAuditLog: TransactionAuditLog = {
      id: `log-${Date.now()}`,
      timestamp: nowStr,
      action: 'EDIT',
      user: userName,
      reason: editReason.trim(),
      changesSummary: summaryText,
      isBackdate: editingRecord.isBackdate,
      backdateDate: editingRecord.date,
      backdateReason: editingRecord.backdateReason,
    };

    const updatedAuditLogs = original?.auditLogs
      ? [...original.auditLogs, newAuditLog]
      : [newAuditLog];

    const updatedRecord: FinancialRecord = {
      ...editingRecord,
      backdateDate: editingRecord.isBackdate ? editingRecord.date : undefined,
      auditLogs: updatedAuditLogs,
    };

    if (onUpdateFinanceRecord) {
      onUpdateFinanceRecord(updatedRecord);
    }
    setEditingRecord(null);
    setEditReason('');
  };

  // Open Delete Confirmation
  const handleOpenDelete = (rec: FinancialRecord) => {
    setDeletingRecord(rec);
    setDeleteReason('');
  };

  // Confirm Soft Delete
  const handleConfirmDelete = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletingRecord || !deleteReason.trim()) return;

    const userName = currentUser?.name || 'Admin Keuangan Yusuf Property';
    const nowStr = new Date().toLocaleString('id-ID');

    const deleteAuditLog: TransactionAuditLog = {
      id: `log-${Date.now()}`,
      timestamp: nowStr,
      action: 'DELETE',
      user: userName,
      reason: deleteReason.trim(),
      changesSummary: `Transaksi senilai ${formatRupiah(deletingRecord.amount)} dihapus dari jurnal aktif.`,
    };

    const updatedAuditLogs = deletingRecord.auditLogs
      ? [...deletingRecord.auditLogs, deleteAuditLog]
      : [deleteAuditLog];

    const deletedRecord: FinancialRecord = {
      ...deletingRecord,
      isDeleted: true,
      deletedAt: nowStr,
      deletedBy: userName,
      deleteReason: deleteReason.trim(),
      auditLogs: updatedAuditLogs,
    };

    if (onDeleteFinanceRecord) {
      onDeleteFinanceRecord(deletingRecord.id, deleteReason.trim(), userName);
    } else if (onUpdateFinanceRecord) {
      onUpdateFinanceRecord(deletedRecord);
    }

    setDeletingRecord(null);
    setDeleteReason('');
  };

  // Restore Soft-Deleted Record
  const handleRestoreRecord = (rec: FinancialRecord) => {
    const userName = currentUser?.name || 'Admin Keuangan Yusuf Property';
    if (onRestoreFinanceRecord) {
      onRestoreFinanceRecord(rec.id, 'Pemulihan transaksi dari daftar hapus ke jurnal aktif', userName);
    }
  };

  // Confirm Permanent Delete
  const handleConfirmPermanentDelete = () => {
    if (!permanentDeletingRecord) return;
    const userName = currentUser?.name || 'Admin Keuangan Yusuf Property';
    if (onPermanentDeleteFinanceRecord) {
      onPermanentDeleteFinanceRecord(permanentDeletingRecord.id, userName);
    }
    setPermanentDeletingRecord(null);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Wallet className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Jurnal Keuangan ERP & Audit Perubahan Transaksi</h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Radio className="w-3 h-3 text-emerald-600 animate-pulse" />
              Sync Real-time Semua User
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Catat arus kas proyek perumahan lengkap dengan fitur Edit, Hapus, dan Riwayat Audit History perubahan. Setiap perubahan langsung terhubung ke Saldo, Laporan, Kartu Piutang & SPR untuk semua pengguna.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all active:scale-95 self-start md:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Catat Transaksi Kas Baru</span>
        </button>
      </div>

      {/* Financial Summary Top Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Saldo Awal Bulan Sebelumnya */}
        <div className="bg-slate-800 text-white p-4.5 rounded-2xl border border-slate-700 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">Saldo Bulan Sebelumnya</span>
            <div className="p-1.5 bg-amber-400/20 text-amber-400 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {formatRupiah(saldoAwalBulan)}
          </div>
          <p className="text-[11px] text-slate-400">
            Saldo awal {formatMonthLabel(selectedMonthKey)}
          </p>
        </div>

        {/* Total Incomes */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Cash In (Pemasukan)</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-700 tracking-tight">
            {formatRupiah(totalIncomeMonth)}
          </div>
          <p className="text-[11px] text-slate-500">
            {selectedMonthKey === 'all' ? 'Total penerimaan kas' : `Pemasukan ${formatMonthLabel(selectedMonthKey)}`}
          </p>
        </div>

        {/* Total Expenses */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">Cash Out (Pengeluaran)</span>
            <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-rose-700 tracking-tight">
            {formatRupiah(totalExpenseMonth)}
          </div>
          <p className="text-[11px] text-slate-500">
            {selectedMonthKey === 'all' ? 'Total pengeluaran kas' : `Pengeluaran ${formatMonthLabel(selectedMonthKey)}`}
          </p>
        </div>

        {/* Saldo Akhir Bulan Ini */}
        <div className="bg-slate-900 text-white p-4.5 rounded-2xl border border-slate-800 shadow-md space-y-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">Saldo Akhir Bulan Ini</span>
            <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-400 tracking-tight">
            {formatRupiah(saldoAkhirBulan)}
          </div>
          <p className="text-[10px] text-amber-300 font-medium">
            ✨ Otomatis jadi Saldo Awal bulan berikutnya
          </p>
        </div>
      </div>

      {/* Finance Filter & Table */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-slate-100 pb-3 gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Jurnal Transaksi Kas Proyek & Saldo Running</h3>
            <p className="text-[11px] text-slate-400">
              Saldo otomatis menyesuaikan dari saldo bulan sebelumnya dan riwayat cash in/out.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Box */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari ref, pengirim, penerima..."
                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 w-48 sm:w-56"
              />
            </div>

            {/* Month Selector */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <Calendar className="w-3.5 h-3.5 text-slate-500 ml-1.5" />
              <select
                value={selectedMonthKey}
                onChange={(e) => setSelectedMonthKey(e.target.value)}
                className="bg-transparent font-extrabold text-xs text-slate-800 focus:outline-none pr-2 cursor-pointer"
              >
                <option value="all">Semua Periode</option>
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthLabel(m)}
                  </option>
                ))}
              </select>
            </div>

            {/* Type Filter Tabs */}
            <div className="flex items-center gap-1 text-xs">
              <button
                onClick={() => setFilterType('active')}
                className={`px-3 py-1.5 rounded-xl font-extrabold transition-all ${
                  filterType === 'active'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Aktif ({currentMonthFinances.length})
              </button>
              <button
                onClick={() => setFilterType('income')}
                className={`px-3 py-1.5 rounded-xl font-extrabold transition-all ${
                  filterType === 'income'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                Pemasukan
              </button>
              <button
                onClick={() => setFilterType('expense')}
                className={`px-3 py-1.5 rounded-xl font-extrabold transition-all ${
                  filterType === 'expense'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
                }`}
              >
                Pengeluaran
              </button>
              <button
                onClick={() => setFilterType('deleted')}
                className={`px-3 py-1.5 rounded-xl font-extrabold transition-all ${
                  filterType === 'deleted'
                    ? 'bg-rose-900 text-white shadow-sm'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                }`}
              >
                Hapus ({finances.filter((f) => f.isDeleted).length})
              </button>
            </div>
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider">
                <th className="p-3 rounded-tl-xl">Tanggal / Ref</th>
                <th className="p-3">Keterangan Transaksi</th>
                <th className="p-3">Proyek / Unit</th>
                <th className="p-3">Pengirim & Penerima Dana</th>
                <th className="p-3 text-right">Cash In / Out</th>
                <th className="p-3 text-right bg-slate-800 text-amber-400">Saldo Akumulasi</th>
                <th className="p-3 text-center rounded-tr-xl">Detail & Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              
              {/* Row 1: Saldo Bulan Sebelumnya (Opening Balance) */}
              {filterType !== 'deleted' && (
                <tr className="bg-amber-50/70 border-b-2 border-amber-200/80 font-bold">
                  <td className="p-3 text-amber-900 font-mono">
                    {selectedMonthKey === 'all' ? 'Awal' : `${selectedMonthKey}-01`}
                  </td>
                  <td className="p-3 text-amber-900" colSpan={3}>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-amber-200 text-amber-950 font-black rounded text-[10px]">
                        SALDO AWAL
                      </span>
                      <span>
                        Saldo Sisa Bulan Sebelumnya ({selectedMonthKey === 'all' ? 'Baseline Operasional' : formatMonthLabel(selectedMonthKey)})
                      </span>
                    </div>
                  </td>
                  <td className="p-3 text-right text-slate-400 italic font-normal">
                    -
                  </td>
                  <td className="p-3 text-right font-black text-amber-900 text-sm bg-amber-100/50">
                    {formatRupiah(saldoAwalBulan)}
                  </td>
                  <td className="p-3 text-center text-[10px] text-amber-700 italic">
                    Carry-over
                  </td>
                </tr>
              )}

              {displayFinancesWithRunningBalance.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    Tidak ada transaksi pada filter periode ini.
                  </td>
                </tr>
              ) : (
                displayFinancesWithRunningBalance.map(({ record: f, runningBalance }) => (
                  <tr
                    key={f.id}
                    className={`transition-colors ${
                      f.isDeleted ? 'bg-rose-50/40 text-slate-400 italic line-through' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <td className="p-3 font-semibold text-slate-900">
                      <div>{formatDate(f.date)}</div>
                      {f.isBackdate && (
                        <div className="mt-0.5">
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-100 text-purple-900 font-extrabold text-[9px] rounded border border-purple-300"
                            title={`Keterangan Backdate: ${f.backdateReason || 'Entri Tanggal Mundur'}`}
                          >
                            <Calendar className="w-2.5 h-2.5 text-purple-700 shrink-0" /> BACKDATE
                          </span>
                        </div>
                      )}
                      <div className="text-[10px] text-slate-400 font-normal">{f.refNumber}</div>
                    </td>

                    <td className="p-3 font-medium text-slate-900">
                      <button
                        type="button"
                        onClick={() => setDetailRecord(f)}
                        className="text-left group flex items-start gap-1.5 hover:text-amber-700 transition-colors cursor-pointer"
                        title="Klik untuk melihat detail lengkap transaksi & pengirim/penerima dana"
                      >
                        {f.type === 'income' ? (
                          <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <ArrowUpRight className="w-3.5 h-3.5 text-rose-600 flex-shrink-0 mt-0.5" />
                        )}
                        <div>
                          <span className={f.isDeleted ? 'line-through text-slate-400' : 'font-semibold group-hover:underline'}>
                            {f.title}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded text-[9px] font-bold">
                              {CATEGORY_LABELS[f.category] || f.category}
                            </span>
                            <span className="text-[10px] text-amber-700 font-semibold group-hover:text-amber-900">
                              Lihat Detail →
                            </span>
                          </div>
                        </div>
                      </button>
                      {f.isBackdate && f.backdateReason && (
                        <div className="text-[10px] text-purple-700 font-semibold mt-0.5 flex items-center gap-1">
                          <span>📌 Ket. Backdate:</span>
                          <span className="italic">&quot;{f.backdateReason}&quot;</span>
                        </div>
                      )}
                      {f.isDeleted && (
                        <div className="text-[10px] text-rose-600 not-italic font-bold mt-0.5">
                          [DIHAPUS]: {f.deleteReason} (oleh {f.deletedBy})
                        </div>
                      )}
                    </td>

                    <td className="p-3">
                      <div className="font-semibold text-slate-800">{f.projectName}</div>
                      {f.unitCode && <div className="text-[10px] text-amber-600 font-bold">Blok {f.unitCode}</div>}
                      <div className="text-[10px] text-slate-400 mt-0.5">Oleh: {f.recordedBy}</div>
                    </td>

                    <td className="p-3 font-medium text-slate-600 min-w-[230px]">
                      <div className="font-bold text-slate-800 text-[11px] mb-1">{f.paymentMethod}</div>
                      <div className="space-y-1">
                        {/* Info Pengirim Dana */}
                        <div className="text-[10px] bg-amber-50/80 border border-amber-200/80 rounded-lg px-2 py-1 text-slate-700">
                          <span className="font-extrabold text-amber-900 uppercase tracking-wide text-[9px] block">
                            Pengirim Dana
                          </span>
                          <div>
                            <strong className="text-slate-900">
                              {f.payerName || (f.type === 'expense' ? 'PT Yusuf Property Indonesia' : '-')}
                            </strong>
                            {f.payerRelationship && (
                              <span className="text-slate-500"> ({f.payerRelationship})</span>
                            )}
                          </div>
                          {(f.senderBankName || f.sourceBank || f.senderAccountNumber) && (
                            <div className="text-slate-600 font-mono text-[9.5px]">
                              {[f.senderBankName || f.sourceBank, f.senderAccountNumber].filter(Boolean).join(' • ')}
                            </div>
                          )}
                        </div>

                        {/* Info Penerima Dana */}
                        <div className="text-[10px] bg-emerald-50/80 border border-emerald-200/80 rounded-lg px-2 py-1 text-emerald-900">
                          <span className="font-extrabold text-emerald-800 uppercase tracking-wide text-[9px] block">
                            Penerima Dana
                          </span>
                          <div>
                            <strong className="text-emerald-950">
                              {f.destinationAccountName || (f.type === 'income' ? 'PT Yusuf Property Indonesia' : '-')}
                            </strong>
                            {f.recipientRelationship && (
                              <span className="text-emerald-700"> ({f.recipientRelationship})</span>
                            )}
                          </div>
                          {(f.destinationBank || f.destinationAccountNumber) && (
                            <div className="text-emerald-800 font-mono text-[9.5px]">
                              {[f.destinationBank, f.destinationAccountNumber].filter(Boolean).join(' • ')}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td
                      className={`p-3 text-right font-black text-sm ${
                        f.isDeleted ? 'text-slate-400 line-through' : f.type === 'income' ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {f.type === 'income' ? '+' : '-'}{formatRupiah(f.amount)}
                    </td>

                    <td className="p-3 text-right font-black text-sm text-slate-900 bg-slate-50/50">
                      {f.isDeleted ? '-' : formatRupiah(runningBalance)}
                    </td>

                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {/* Detail Transaction View Button */}
                        <button
                          onClick={() => setDetailRecord(f)}
                          className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                          title="Lihat Detail Transaksi (Pengirim & Penerima Dana)"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Audit History Log Button */}
                        <button
                          onClick={() => setAuditRecord(f)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all relative cursor-pointer"
                          title="Lihat Riwayat History Audit"
                        >
                          <History className="w-4 h-4" />
                          {f.auditLogs && f.auditLogs.length > 1 && (
                            <span className="absolute -top-1 -right-1 px-1 bg-amber-500 text-slate-950 font-black text-[9px] rounded-full">
                              {f.auditLogs.length}
                            </span>
                          )}
                        </button>

                        {!f.isDeleted ? (
                          <>
                            {/* Edit Button */}
                            <button
                              onClick={() => handleOpenEdit(f)}
                              className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-all"
                              title="Edit Transaksi (Wajib Alasan)"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            {/* Delete Button */}
                            <button
                              onClick={() => handleOpenDelete(f)}
                              className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-all"
                              title="Hapus Transaksi (Wajib Alasan)"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            {onRestoreFinanceRecord && (
                              <button
                                onClick={() => handleRestoreRecord(f)}
                                className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-all"
                                title="Pulihkan Transaksi ke Jurnal Aktif"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}
                            {onPermanentDeleteFinanceRecord && (
                              <button
                                onClick={() => setPermanentDeletingRecord(f)}
                                className="p-1.5 text-rose-700 hover:text-rose-900 hover:bg-rose-100 rounded-lg transition-all"
                                title="Hapus Permanen dari Database Semua User"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}

              {/* Row Final: Saldo Akhir Bulan Ini (Menjadi Saldo Awal Bulan Berikutnya) */}
              {filterType !== 'deleted' && (
                <tr className="bg-slate-900 text-white font-extrabold border-t-2 border-slate-700">
                  <td className="p-3 text-amber-400 font-mono">Akhir</td>
                  <td className="p-3" colSpan={3}>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-amber-400 text-slate-950 font-black rounded text-[10px]">
                        SALDO AKHIR
                      </span>
                      <span className="text-slate-200">
                        Saldo Akhir {formatMonthLabel(selectedMonthKey)} — Otomatis Menjadi Saldo Awal Bulan Berikutnya
                      </span>
                    </div>
                  </td>
                  <td className="p-3 text-right text-xs">
                    <span className="text-emerald-400">+{formatRupiah(totalIncomeMonth)}</span>
                    <span className="text-slate-400 mx-1">/</span>
                    <span className="text-rose-400">-{formatRupiah(totalExpenseMonth)}</span>
                  </td>
                  <td className="p-3 text-right font-black text-amber-400 text-base bg-slate-800">
                    {formatRupiah(saldoAkhirBulan)}
                  </td>
                  <td className="p-3 text-center text-[10px] text-amber-300">
                    ✨ Final
                  </td>
                </tr>
              )}

            </tbody>
          </table>
        </div>
      </div>

      {/* Modal 1: Catat Transaksi Baru */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-slate-900 p-4 text-white flex justify-between items-center shrink-0">
              <span className="font-bold text-sm">Catat Transaksi Kas Baru</span>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSubmitNewRecord} className="p-5 space-y-4 text-xs overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Jenis Transaksi</label>
                  <select
                    value={type}
                    onChange={(e) => {
                      const nextType = e.target.value as 'income' | 'expense';
                      setType(nextType);
                      if (nextType === 'expense') {
                        setCategory('material_konstruksi');
                        setRecipientRelationship('Supplier / Vendor / Mandor');
                        setPayerRelationship('Perusahaan / PT');
                      } else {
                        setCategory('dp_pembayaran');
                        setRecipientRelationship('Rekening Perusahaan (PT Yusuf Property)');
                        setPayerRelationship('Konsumen Langsung (Pribadi)');
                      }
                    }}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold"
                  >
                    <option value="income">Pemasukan (+)</option>
                    <option value="expense">Pengeluaran (-)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Kategori</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as FinancialRecord['category'])}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold"
                  >
                    <option value="booking_fee">Booking Fee / UTJ</option>
                    <option value="dp_pembayaran">Pembayaran Uang Muka (DP)</option>
                    <option value="pencairan_kpr">Pencairan KPR Bank</option>
                    <option value="material_konstruksi">Material Konstruksi</option>
                    <option value="gaji_mandor">Upah Mandor & Pekerja</option>
                    <option value="legal_sertifikat">Legal & Sertifikat</option>
                    <option value="pemasaran">Pemasaran / Komisi</option>
                    <option value="lainnya">Operasional / Lainnya</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Nominal (Rp)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-amber-600"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Keterangan / Deskripsi</label>
                <input
                  type="text"
                  placeholder="Contoh: Pembayaran DP Unit A-02 / Pembelian Semen"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Proyek</label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Blok / Unit (Opsional)</label>
                  <input
                    type="text"
                    placeholder="Contoh: A-02"
                    value={unitCode}
                    onChange={(e) => setUnitCode(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Metode Pembayaran</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPaymentMethod(val);
                      if (val === 'Cash / Tunai') {
                        setSourceBank('Cash / Tunai');
                        setSenderBankName('Cash / Tunai');
                      } else if (sourceBank === 'Cash / Tunai') {
                        setSourceBank('Bank BCA');
                        setSenderBankName('Bank BCA');
                      }
                    }}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold"
                  >
                    <option value="Transfer Bank">Transfer Bank</option>
                    <option value="Virtual Account / QRIS">Virtual Account / QRIS</option>
                    <option value="Cash / Tunai">Cash / Tunai</option>
                    <option value="Cek / Giro">Cek / Giro</option>
                  </select>
                </div>
              </div>

              {/* Sumber Pembayaran & Bank Pengirim */}
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/70 space-y-3">
                <div className="text-[11px] font-extrabold text-amber-950 uppercase tracking-wider border-b border-amber-200/70 pb-1">
                  Sumber Pembayaran & Bank Pengirim
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-amber-900 block mb-1">Sumber Pembayaran (Dari Bank)</label>
                    <select
                      value={sourceBank}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSourceBank(val);
                        if (val === 'Cash / Tunai') {
                          setPaymentMethod('Cash / Tunai');
                          setSenderBankName('Cash / Tunai');
                        } else {
                          if (paymentMethod === 'Cash / Tunai') {
                            setPaymentMethod('Transfer Bank');
                          }
                          if (val !== 'Lainnya') {
                            setSenderBankName(val);
                          } else {
                            setSenderBankName('');
                          }
                        }
                      }}
                      className="w-full p-2 bg-white border border-amber-200 rounded-lg font-bold text-slate-800"
                    >
                      <option value="Bank BCA">Bank BCA</option>
                      <option value="Bank Mandiri">Bank Mandiri</option>
                      <option value="Bank BRI">Bank BRI</option>
                      <option value="Bank BNI">Bank BNI</option>
                      <option value="Bank BTN">Bank BTN</option>
                      <option value="Bank BSI (Syariah)">Bank BSI (Syariah)</option>
                      <option value="Bank CIMB Niaga">Bank CIMB Niaga</option>
                      <option value="Bank Permata">Bank Permata</option>
                      <option value="Bank Danamon">Bank Danamon</option>
                      <option value="Bank BPD / Syariah Lainnya">Bank BPD / Syariah Lainnya</option>
                      <option value="Cash / Tunai">Cash / Tunai</option>
                      <option value="Lainnya">Bank Lainnya (Ketik Manual)</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-amber-900 block mb-1">Nama Bank Pengirim</label>
                    <input
                      type="text"
                      placeholder="Contoh: Bank BCA / Bank Mandiri Syariah"
                      value={senderBankName}
                      onChange={(e) => setSenderBankName(e.target.value)}
                      className="w-full p-2 bg-white border border-amber-200 rounded-lg font-medium text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-amber-900 block mb-1">Nama Pengirim / Pemilik Rekening</label>
                    <input
                      type="text"
                      placeholder="Nama lengkap pengirim dana"
                      value={payerName}
                      onChange={(e) => setPayerName(e.target.value)}
                      className="w-full p-2 bg-white border border-amber-200 rounded-lg font-medium"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-amber-900 block mb-1">No. Rekening Pengirim (Opsional)</label>
                    <input
                      type="text"
                      placeholder="Contoh: 8820192831"
                      value={senderAccountNumber}
                      onChange={(e) => setSenderAccountNumber(e.target.value)}
                      className="w-full p-2 bg-white border border-amber-200 rounded-lg font-mono text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-amber-900 block mb-1">Hubungan / Status Pengirim</label>
                  <select
                    value={payerRelationship}
                    onChange={(e) => setPayerRelationship(e.target.value)}
                    className="w-full p-2 bg-white border border-amber-200 rounded-lg font-medium"
                  >
                    <option value="Konsumen Langsung (Pribadi)">Konsumen Langsung (Pribadi)</option>
                    <option value="Pasangan (Suami / Istri)">Pasangan (Suami / Istri)</option>
                    <option value="Orang Tua / Anak">Orang Tua / Anak</option>
                    <option value="Perusahaan / PT">Perusahaan / PT</option>
                    <option value="Bank / Lembaga Pembiayaan">Bank / Lembaga Pembiayaan</option>
                  </select>
                </div>
              </div>

              {/* Informasi Penerima Dana & Rekening Tujuan */}
              <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200/80 space-y-3">
                <div className="text-[11px] font-extrabold text-emerald-950 uppercase tracking-wider border-b border-emerald-200/80 pb-1">
                  Informasi Penerima Dana & Rekening Tujuan
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-emerald-900 block mb-1">Bank Penerima (Rekening Tujuan)</label>
                    <select
                      value={destinationBank}
                      onChange={(e) => {
                        setDestinationBank(e.target.value);
                        if (e.target.value !== 'Lainnya') {
                          setDestinationBankCustom('');
                        }
                      }}
                      className="w-full p-2 bg-white border border-emerald-200 rounded-lg font-bold text-slate-800"
                    >
                      <option value="Bank BCA">Bank BCA</option>
                      <option value="Bank Mandiri">Bank Mandiri</option>
                      <option value="Bank BRI">Bank BRI</option>
                      <option value="Bank BNI">Bank BNI</option>
                      <option value="Bank BTN">Bank BTN</option>
                      <option value="Bank BSI (Syariah)">Bank BSI (Syariah)</option>
                      <option value="Bank CIMB Niaga">Bank CIMB Niaga</option>
                      <option value="Bank Permata">Bank Permata</option>
                      <option value="Bank Danamon">Bank Danamon</option>
                      <option value="Bank BPD / Syariah Lainnya">Bank BPD / Syariah Lainnya</option>
                      <option value="Kas / Tunai">Kas / Tunai</option>
                      <option value="Lainnya">Bank Lainnya (Ketik Manual)</option>
                    </select>
                  </div>
                  {destinationBank === 'Lainnya' ? (
                    <div>
                      <label className="font-bold text-emerald-900 block mb-1">Nama Bank Penerima (Manual)</label>
                      <input
                        type="text"
                        placeholder="Ketik nama bank penerima"
                        value={destinationBankCustom}
                        onChange={(e) => setDestinationBankCustom(e.target.value)}
                        className="w-full p-2 bg-white border border-emerald-200 rounded-lg font-medium text-slate-900"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="font-bold text-emerald-900 block mb-1">No. Rekening Tujuan (Input Manual)</label>
                      <input
                        type="text"
                        placeholder="Contoh: 1234567890"
                        value={destinationAccountNumber}
                        onChange={(e) => setDestinationAccountNumber(e.target.value)}
                        className="w-full p-2 bg-white border border-emerald-200 rounded-lg font-medium text-slate-900 font-mono"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {destinationBank === 'Lainnya' && (
                    <div className="sm:col-span-2">
                      <label className="font-bold text-emerald-900 block mb-1">No. Rekening Tujuan (Input Manual)</label>
                      <input
                        type="text"
                        placeholder="Contoh: 1234567890"
                        value={destinationAccountNumber}
                        onChange={(e) => setDestinationAccountNumber(e.target.value)}
                        className="w-full p-2 bg-white border border-emerald-200 rounded-lg font-medium text-slate-900 font-mono"
                      />
                    </div>
                  )}
                  <div>
                    <label className="font-bold text-emerald-900 block mb-1">Nama Penerima / Pemilik Rekening</label>
                    <input
                      type="text"
                      placeholder="Contoh: PT Yusuf Property Indonesia"
                      value={destinationAccountName}
                      onChange={(e) => setDestinationAccountName(e.target.value)}
                      className="w-full p-2 bg-white border border-emerald-200 rounded-lg font-medium text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-emerald-900 block mb-1">Status / Peran Penerima Dana</label>
                    <input
                      type="text"
                      placeholder="Contoh: Rekening Perusahaan / Supplier / Mandor"
                      value={recipientRelationship}
                      onChange={(e) => setRecipientRelationship(e.target.value)}
                      className="w-full p-2 bg-white border border-emerald-200 rounded-lg font-medium text-slate-900"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Catatan Tambahan Detail Transaksi (Opsional)</label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Bukti transfer telah dicek mutasi rekening koran BCA oleh Finance"
                  value={transactionNotes}
                  onChange={(e) => setTransactionNotes(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-900"
                />
              </div>

              {/* Opsi Backdate / Tanggal Mundur */}
              <div className="p-3 bg-purple-50/80 rounded-xl border border-purple-200 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-purple-950 text-xs">
                  <input
                    type="checkbox"
                    checked={isBackdate}
                    onChange={(e) => setIsBackdate(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-purple-600" />
                    Input Transaksi Tanggal Mundur (Backdate)
                  </span>
                </label>
                {isBackdate && (
                  <div className="grid grid-cols-2 gap-2.5 pt-1 animate-in fade-in duration-150">
                    <div>
                      <label className="font-bold text-purple-900 block mb-1 text-[11px]">Tanggal Backdate *</label>
                      <input
                        type="date"
                        required={isBackdate}
                        value={backdateDate}
                        onChange={(e) => setBackdateDate(e.target.value)}
                        className="w-full p-2 bg-white border border-purple-300 rounded-lg font-bold text-purple-900 text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-purple-900 block mb-1 text-[11px]">Keterangan & Alasan Backdate *</label>
                      <input
                        type="text"
                        required={isBackdate}
                        placeholder="Contoh: Pencatatan kuitansi susulan bulan lalu"
                        value={backdateReason}
                        onChange={(e) => setBackdateReason(e.target.value)}
                        className="w-full p-2 bg-white border border-purple-300 rounded-lg font-medium text-slate-900 text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-slate-600 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl"
                >
                  Simpan Transaksi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Edit Transaksi & Record History Reason */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-slate-900 p-4 text-white flex justify-between items-center shrink-0">
              <span className="font-bold text-sm flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-400" /> Edit Transaksi (Wajib Alasan Perubahan)
              </span>
              <button onClick={() => setEditingRecord(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4 text-xs overflow-y-auto">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 font-medium text-[11px] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>Setiap perubahan data transaksi akan tercatat permanent di audit history sistem ERP.</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Nominal Baru (Rp) *</label>
                  <input
                    type="number"
                    required
                    value={editingRecord.amount}
                    onChange={(e) => setEditingRecord({ ...editingRecord, amount: Number(e.target.value) })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-black text-amber-700"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Metode Bayar</label>
                  <input
                    type="text"
                    value={editingRecord.paymentMethod}
                    onChange={(e) => setEditingRecord({ ...editingRecord, paymentMethod: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Keterangan / Judul Transaksi *</label>
                <input
                  type="text"
                  required
                  value={editingRecord.title}
                  onChange={(e) => setEditingRecord({ ...editingRecord, title: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Proyek</label>
                  <input
                    type="text"
                    value={editingRecord.projectName}
                    onChange={(e) => setEditingRecord({ ...editingRecord, projectName: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Blok / Unit</label>
                  <input
                    type="text"
                    value={editingRecord.unitCode || ''}
                    onChange={(e) => setEditingRecord({ ...editingRecord, unitCode: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="p-3 bg-amber-50/60 border border-amber-200/70 rounded-xl space-y-3">
                <div className="text-[11px] font-extrabold text-amber-950 uppercase tracking-wider border-b border-amber-200/70 pb-1">
                  Informasi Pengirim Dana
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-amber-900 block mb-1">Nama Pengirim / Atas Nama</label>
                    <input
                      type="text"
                      value={editingRecord.payerName || ''}
                      onChange={(e) => setEditingRecord({ ...editingRecord, payerName: e.target.value })}
                      className="w-full p-2 bg-white border border-amber-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-amber-900 block mb-1">Hubungan Pengirim</label>
                    <input
                      type="text"
                      value={editingRecord.payerRelationship || ''}
                      onChange={(e) => setEditingRecord({ ...editingRecord, payerRelationship: e.target.value })}
                      className="w-full p-2 bg-white border border-amber-200 rounded-lg"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-bold text-amber-900 block mb-1">Sumber Pembayaran</label>
                    <input
                      type="text"
                      placeholder="Bank BCA / Cash"
                      value={editingRecord.sourceBank || ''}
                      onChange={(e) => setEditingRecord({ ...editingRecord, sourceBank: e.target.value })}
                      className="w-full p-2 bg-white border border-amber-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-amber-900 block mb-1">Nama Bank Pengirim</label>
                    <input
                      type="text"
                      placeholder="Contoh: Bank BCA"
                      value={editingRecord.senderBankName || ''}
                      onChange={(e) => setEditingRecord({ ...editingRecord, senderBankName: e.target.value })}
                      className="w-full p-2 bg-white border border-amber-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-amber-900 block mb-1">No. Rekening Pengirim</label>
                    <input
                      type="text"
                      placeholder="No. Rek Pengirim"
                      value={editingRecord.senderAccountNumber || ''}
                      onChange={(e) => setEditingRecord({ ...editingRecord, senderAccountNumber: e.target.value })}
                      className="w-full p-2 bg-white border border-amber-200 rounded-lg font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-emerald-900 block mb-1">Bank Penerima (Rekening Tujuan)</label>
                    <select
                      value={
                        [
                          'Bank BCA',
                          'Bank Mandiri',
                          'Bank BRI',
                          'Bank BNI',
                          'Bank BTN',
                          'Bank BSI (Syariah)',
                          'Bank CIMB Niaga',
                          'Bank Permata',
                          'Bank Danamon',
                          'Bank BPD / Syariah Lainnya',
                          'Kas / Tunai',
                        ].includes(editingRecord.destinationBank || '')
                          ? editingRecord.destinationBank
                          : editingRecord.destinationBank
                          ? 'Lainnya'
                          : ''
                      }
                      onChange={(e) =>
                        setEditingRecord({
                          ...editingRecord,
                          destinationBank: e.target.value,
                        })
                      }
                      className="w-full p-2 bg-white border border-emerald-200 rounded-lg font-bold text-slate-800"
                    >
                      <option value="">-- Pilih Bank Penerima --</option>
                      <option value="Bank BCA">Bank BCA</option>
                      <option value="Bank Mandiri">Bank Mandiri</option>
                      <option value="Bank BRI">Bank BRI</option>
                      <option value="Bank BNI">Bank BNI</option>
                      <option value="Bank BTN">Bank BTN</option>
                      <option value="Bank BSI (Syariah)">Bank BSI (Syariah)</option>
                      <option value="Bank CIMB Niaga">Bank CIMB Niaga</option>
                      <option value="Bank Permata">Bank Permata</option>
                      <option value="Bank Danamon">Bank Danamon</option>
                      <option value="Bank BPD / Syariah Lainnya">Bank BPD / Syariah Lainnya</option>
                      <option value="Kas / Tunai">Kas / Tunai</option>
                      <option value="Lainnya">Bank Lainnya (Ketik Manual)</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-emerald-900 block mb-1">No. Rekening Tujuan (Manual)</label>
                    <input
                      type="text"
                      placeholder="No. Rekening Tujuan"
                      value={editingRecord.destinationAccountNumber || ''}
                      onChange={(e) => setEditingRecord({ ...editingRecord, destinationAccountNumber: e.target.value })}
                      className="w-full p-2 bg-white border border-emerald-200 rounded-lg font-mono"
                    />
                  </div>
                </div>
                {editingRecord.destinationBank !== undefined &&
                  ![
                    '',
                    'Bank BCA',
                    'Bank Mandiri',
                    'Bank BRI',
                    'Bank BNI',
                    'Bank BTN',
                    'Bank BSI (Syariah)',
                    'Bank CIMB Niaga',
                    'Bank Permata',
                    'Bank Danamon',
                    'Bank BPD / Syariah Lainnya',
                    'Kas / Tunai',
                  ].includes(editingRecord.destinationBank) && (
                    <div>
                      <label className="font-bold text-emerald-900 block mb-1">Nama Bank Penerima (Manual)</label>
                      <input
                        type="text"
                        placeholder="Ketik nama bank penerima"
                        value={editingRecord.destinationBank === 'Lainnya' ? '' : editingRecord.destinationBank || ''}
                        onChange={(e) =>
                          setEditingRecord({
                            ...editingRecord,
                            destinationBank: e.target.value || 'Lainnya',
                          })
                        }
                        className="w-full p-2 bg-white border border-emerald-200 rounded-lg"
                      />
                    </div>
                  )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-emerald-900 block mb-1">Nama Penerima / Pemilik Rekening (Manual)</label>
                    <input
                      type="text"
                      placeholder="Nama Pemilik Rekening Tujuan"
                      value={editingRecord.destinationAccountName || ''}
                      onChange={(e) => setEditingRecord({ ...editingRecord, destinationAccountName: e.target.value })}
                      className="w-full p-2 bg-white border border-emerald-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-emerald-900 block mb-1">Status / Peran Penerima Dana</label>
                    <input
                      type="text"
                      placeholder="Contoh: Rekening Perusahaan / Supplier"
                      value={editingRecord.recipientRelationship || ''}
                      onChange={(e) => setEditingRecord({ ...editingRecord, recipientRelationship: e.target.value })}
                      className="w-full p-2 bg-white border border-emerald-200 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Catatan Detail Transaksi</label>
                <textarea
                  rows={2}
                  value={editingRecord.transactionNotes || ''}
                  onChange={(e) => setEditingRecord({ ...editingRecord, transactionNotes: e.target.value })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              {/* Pengaturan Tanggal & Opsi Backdate Edit */}
              <div className="p-3 bg-purple-50/80 border border-purple-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-purple-950 text-xs">
                    <input
                      type="checkbox"
                      checked={editingRecord.isBackdate || false}
                      onChange={(e) =>
                        setEditingRecord({
                          ...editingRecord,
                          isBackdate: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-purple-600" />
                      Status Backdate (Entri Tanggal Mundur)
                    </span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <div>
                    <label className="font-bold text-purple-900 block mb-1 text-[11px]">Tanggal Transaksi *</label>
                    <input
                      type="date"
                      required
                      value={editingRecord.date}
                      onChange={(e) =>
                        setEditingRecord({
                          ...editingRecord,
                          date: e.target.value,
                        })
                      }
                      className="w-full p-2 bg-white border border-purple-300 rounded-lg font-bold text-purple-900 text-xs"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-purple-900 block mb-1 text-[11px]">Keterangan & Detail Backdate</label>
                    <input
                      type="text"
                      placeholder="Contoh: Koreksi tanggal pencairan KPR BTN"
                      value={editingRecord.backdateReason || ''}
                      onChange={(e) =>
                        setEditingRecord({
                          ...editingRecord,
                          backdateReason: e.target.value,
                        })
                      }
                      className="w-full p-2 bg-white border border-purple-300 rounded-lg font-medium text-slate-900 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* MANDATORY REASON FIELD */}
              <div className="p-3 bg-slate-900 text-white rounded-xl space-y-1.5">
                <label className="font-extrabold text-amber-400 block text-xs">
                  Alasan Perubahan Data Transaksi (WAJIB DIISI) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Koreksi nominal pembayaran KPR dari bank / Perbaikan kuitansi"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg font-medium text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <p className="text-[10px] text-slate-400">*Alasan ini akan tersimpan permanen di jurnal audit auditLog.</p>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2 text-slate-600 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!editReason.trim()}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl disabled:opacity-50"
                >
                  Simpan & Record Audit Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Hapus Transaksi & Mandatory Reason */}
      {deletingRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="bg-rose-900 p-4 text-white flex justify-between items-center">
              <span className="font-bold text-sm flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-300" /> Konfirmasi Penghapusan Transaksi Kas
              </span>
              <button onClick={() => setDeletingRecord(null)} className="text-slate-300 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleConfirmDelete} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 font-medium">
                <p className="font-bold">Transaksi yang akan dihapus:</p>
                <p className="text-xs font-black text-rose-950 mt-1">
                  &quot;{deletingRecord.title}&quot; — {formatRupiah(deletingRecord.amount)}
                </p>
                <p className="text-[10px] text-rose-700 mt-1">Ref: {deletingRecord.refNumber}</p>
              </div>

              <div className="space-y-1.5">
                <label className="font-extrabold text-slate-900 block">
                  Alasan Penghapusan Transaksi (WAJIB DIISI) *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Contoh: Transaksi ganda / Pembatalan akad oleh konsumen / Terjadi kesalahan penginputan nominal"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 text-xs"
                />
              </div>

              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900">
                Penghapusan ini langsung terhubung & memperbarui saldo kas, laporan ERP, kartu piutang konsumen, SPR terkait, serta tersinkronisasi real-time untuk seluruh pengguna aplikasi.
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeletingRecord(null)}
                  className="px-4 py-2 text-slate-600 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!deleteReason.trim()}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl disabled:opacity-50"
                >
                  Hapus & Record History
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3b: Hapus Permanen Konfirmasi */}
      {permanentDeletingRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="bg-rose-950 p-4 text-white flex justify-between items-center">
              <span className="font-bold text-sm flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" /> Hapus Transaksi Permanen
              </span>
              <button onClick={() => setPermanentDeletingRecord(null)} className="text-slate-300 hover:text-white">✕</button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 font-medium">
                <p className="font-bold">Transaksi ini akan dihapus permanen untuk semua pengguna:</p>
                <p className="text-xs font-black text-rose-950 mt-1">
                  &quot;{permanentDeletingRecord.title}&quot; — {formatRupiah(permanentDeletingRecord.amount)}
                </p>
                <p className="text-[10px] text-rose-700 mt-1">Ref: {permanentDeletingRecord.refNumber}</p>
              </div>
              <p className="text-[11px] text-slate-600">
                Tindakan ini tidak dapat dikembalikan dan langsung tersinkronisasi ke database cloud seluruh pemakai aplikasi.
              </p>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPermanentDeletingRecord(null)}
                  className="px-4 py-2 text-slate-600 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPermanentDelete}
                  className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white font-extrabold rounded-xl"
                >
                  Ya, Hapus Permanen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Audit Log History Trail View */}
      {activeAuditRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden max-h-[85vh] flex flex-col">
            <div className="bg-slate-900 p-4 text-white flex justify-between items-center">
              <div>
                <span className="font-bold text-sm flex items-center gap-2">
                  <History className="w-4 h-4 text-amber-400" /> Audit History & Jejak Perubahan Transaksi
                </span>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">Ref: {activeAuditRecord.refNumber}</p>
              </div>
              <button onClick={() => setAuditRecord(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="p-5 space-y-4 text-xs overflow-y-auto">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <p className="font-bold text-slate-900">{activeAuditRecord.title}</p>
                <p className="text-sm font-black text-emerald-700">{formatRupiah(activeAuditRecord.amount)}</p>
                <p className="text-[10px] text-slate-500">
                  Proyek: {activeAuditRecord.projectName} {activeAuditRecord.unitCode && `(Blok ${activeAuditRecord.unitCode})`}
                </p>
                {(activeAuditRecord.sourceBank || activeAuditRecord.senderBankName || activeAuditRecord.destinationBank || activeAuditRecord.destinationAccountNumber || activeAuditRecord.destinationAccountName) && (
                  <div className="pt-1 mt-1 border-t border-slate-200 text-[10px] text-slate-600 space-y-0.5">
                    {(activeAuditRecord.sourceBank || activeAuditRecord.senderBankName) && (
                      <p>
                        Sumber / Bank Pengirim: <strong>{activeAuditRecord.senderBankName || activeAuditRecord.sourceBank}</strong>
                        {activeAuditRecord.payerName && ` (a.n. ${activeAuditRecord.payerName})`}
                      </p>
                    )}
                    {(activeAuditRecord.destinationBank || activeAuditRecord.destinationAccountNumber || activeAuditRecord.destinationAccountName) && (
                      <p>
                        Rekening Tujuan:{' '}
                        <strong>
                          {[activeAuditRecord.destinationBank, activeAuditRecord.destinationAccountNumber].filter(Boolean).join(' - ') || '-'}
                        </strong>
                        {activeAuditRecord.destinationAccountName && ` (a.n. ${activeAuditRecord.destinationAccountName})`}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-slate-900 text-xs border-b border-slate-200 pb-1">
                  Timeline Perubahan & Alasan Tindakan
                </h4>

                {!activeAuditRecord.auditLogs || activeAuditRecord.auditLogs.length === 0 ? (
                  <div className="p-4 text-center text-slate-400">Belum ada catatan audit log tersimpan.</div>
                ) : (
                  <div className="space-y-2.5 relative before:absolute before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                    {activeAuditRecord.auditLogs.map((log) => (
                      <div key={log.id} className="relative pl-8 space-y-1">
                        <div className="absolute left-2 top-1.5 w-3 h-3 rounded-full bg-amber-500 border-2 border-white ring-2 ring-amber-100"></div>

                        <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1 shadow-2xs">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                                  log.action === 'CREATE'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : log.action === 'EDIT'
                                    ? 'bg-amber-100 text-amber-900'
                                    : log.action === 'RESTORE'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {log.action}
                              </span>
                              <span>{log.user}</span>
                            </span>
                            <span className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" /> {log.timestamp}
                            </span>
                          </div>

                          <div className="text-slate-700 pt-0.5">
                            <span className="font-bold text-slate-900">Alasan Tindakan:</span> &quot;{log.reason}&quot;
                          </div>

                          {log.isBackdate && (
                            <div className="text-[10px] text-purple-900 bg-purple-50 p-2 rounded-lg border border-purple-200 space-y-0.5">
                              <p className="font-extrabold flex items-center gap-1 text-purple-900">
                                <Calendar className="w-3 h-3 text-purple-700" />
                                <span>Status Entri Backdate ({log.backdateDate || activeAuditRecord.date})</span>
                              </p>
                              {log.backdateReason && (
                                <p className="text-purple-800">
                                  <strong>Keterangan Backdate:</strong> &quot;{log.backdateReason}&quot;
                                </p>
                              )}
                            </div>
                          )}

                          {log.changesSummary && (
                            <div className="text-[10px] text-slate-500 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                              {log.changesSummary}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setAuditRecord(null)}
                className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: Tampilan Detail Catatan Transaksi (Pengirim & Penerima Dana) */}
      {activeDetailRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-slate-900 p-4 text-white flex justify-between items-start gap-3 shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-400" />
                    Detail Catatan Transaksi Keuangan
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                      activeDetailRecord.type === 'income'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    }`}
                  >
                    {activeDetailRecord.type === 'income' ? 'Cash In (Pemasukan)' : 'Cash Out (Pengeluaran)'}
                  </span>
                  {activeDetailRecord.isBackdate && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-500/20 text-purple-200 border border-purple-400/40">
                      BACKDATE
                    </span>
                  )}
                  {activeDetailRecord.isDeleted && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white">
                      DIHAPUS
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 font-mono">
                  Ref: {activeDetailRecord.refNumber} • Tanggal: {formatDate(activeDetailRecord.date)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailRecord(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
                title="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs overflow-y-auto">
              {/* Amount & Main Description Card */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Nominal Transaksi
                    </span>
                    <div
                      className={`text-2xl font-black tracking-tight ${
                        activeDetailRecord.isDeleted
                          ? 'text-slate-400 line-through'
                          : activeDetailRecord.type === 'income'
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                      }`}
                    >
                      {activeDetailRecord.type === 'income' ? '+' : '-'}
                      {formatRupiah(activeDetailRecord.amount)}
                    </div>
                  </div>
                  <div className="sm:text-right space-y-1">
                    <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-900 text-amber-400 font-bold text-[10px]">
                      {CATEGORY_LABELS[activeDetailRecord.category] || activeDetailRecord.category}
                    </span>
                    <div className="text-[11px] text-slate-500">
                      Metode: <strong className="text-slate-800">{activeDetailRecord.paymentMethod}</strong>
                    </div>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                    Keterangan / Uraian Transaksi
                  </span>
                  <p className="font-bold text-slate-900 text-sm leading-snug">{activeDetailRecord.title}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                    <span className="text-[10px] text-slate-400 font-semibold block">Proyek Perumahan</span>
                    <span className="font-bold text-slate-800">{activeDetailRecord.projectName || '-'}</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                    <span className="text-[10px] text-slate-400 font-semibold block">Blok / Unit Kavling</span>
                    <span className="font-bold text-amber-700">
                      {activeDetailRecord.unitCode ? `Blok ${activeDetailRecord.unitCode}` : '-'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                    <span className="text-[10px] text-slate-400 font-semibold block">Petugas Pencatat</span>
                    <span className="font-bold text-slate-800">{activeDetailRecord.recordedBy || '-'}</span>
                  </div>
                </div>

                {activeDetailRecord.transactionNotes && (
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                    <span className="text-[10px] text-slate-400 font-semibold block">Catatan Tambahan</span>
                    <p className="text-slate-700 mt-0.5">{activeDetailRecord.transactionNotes}</p>
                  </div>
                )}

                {activeDetailRecord.isBackdate && (
                  <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-xl text-purple-900 space-y-0.5">
                    <div className="font-extrabold flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-purple-700" />
                      <span>Transaksi Backdate (Tanggal Efektif: {formatDate(activeDetailRecord.backdateDate || activeDetailRecord.date)})</span>
                    </div>
                    {activeDetailRecord.backdateReason && (
                      <p className="text-[11px] text-purple-800">
                        Alasan Backdate: &quot;{activeDetailRecord.backdateReason}&quot;
                      </p>
                    )}
                  </div>
                )}

                {activeDetailRecord.isDeleted && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 space-y-0.5">
                    <div className="font-extrabold flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                      <span>Transaksi Ini Berstatus Dihapus</span>
                    </div>
                    <p className="text-[11px]">
                      Alasan: &quot;{activeDetailRecord.deleteReason || '-'}&quot; • Oleh: {activeDetailRecord.deletedBy || '-'} ({activeDetailRecord.deletedAt || '-'})
                    </p>
                  </div>
                )}
              </div>

              {/* Sender & Receiver Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Card 1: Informasi Pengirim Dana */}
                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-3">
                  <div className="flex items-center gap-2 border-b border-amber-200 pb-2">
                    <div className="p-1.5 bg-amber-500/20 text-amber-800 rounded-lg">
                      <Landmark className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-black text-amber-950 text-xs uppercase tracking-wider">
                        Informasi Pengirim Dana
                      </h4>
                      <p className="text-[10px] text-amber-800">Sumber asal pembayaran / transfer</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-amber-800/80 block">Nama Pengirim / Pemilik Rekening</span>
                      <span className="font-extrabold text-slate-900">
                        {activeDetailRecord.payerName ||
                          (activeDetailRecord.type === 'expense' ? 'PT Yusuf Property Indonesia' : '-')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-amber-800/80 block">Hubungan / Status Pengirim</span>
                      <span className="font-semibold text-slate-800">
                        {activeDetailRecord.payerRelationship ||
                          (activeDetailRecord.type === 'expense' ? 'Perusahaan / PT' : '-')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-amber-800/80 block">Bank / Sumber Pengirim</span>
                      <span className="font-bold text-slate-900">
                        {activeDetailRecord.senderBankName || activeDetailRecord.sourceBank || activeDetailRecord.paymentMethod || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-amber-800/80 block">No. Rekening Pengirim</span>
                      <span className="font-mono font-bold text-slate-900 bg-white px-2 py-1 rounded-lg border border-amber-200 inline-block mt-0.5">
                        {activeDetailRecord.senderAccountNumber || '-'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card 2: Informasi Penerima Dana */}
                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-3">
                  <div className="flex items-center gap-2 border-b border-emerald-200 pb-2">
                    <div className="p-1.5 bg-emerald-500/20 text-emerald-800 rounded-lg">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-black text-emerald-950 text-xs uppercase tracking-wider">
                        Informasi Penerima Dana
                      </h4>
                      <p className="text-[10px] text-emerald-800">Tujuan dana masuk / rekening penerima</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-emerald-800/80 block">Nama Penerima / Pemilik Rekening</span>
                      <span className="font-extrabold text-emerald-950">
                        {activeDetailRecord.destinationAccountName ||
                          (activeDetailRecord.type === 'income' ? 'PT Yusuf Property Indonesia (Kas Perusahaan)' : '-')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-emerald-800/80 block">Status / Peran Penerima</span>
                      <span className="font-semibold text-emerald-900">
                        {activeDetailRecord.recipientRelationship ||
                          (activeDetailRecord.type === 'income'
                            ? 'Rekening Perusahaan (PT Yusuf Property)'
                            : 'Vendor / Mandor / Penerima Dana')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-emerald-800/80 block">Bank Penerima (Rekening Tujuan)</span>
                      <span className="font-bold text-emerald-950">
                        {activeDetailRecord.destinationBank || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-emerald-800/80 block">No. Rekening Tujuan</span>
                      <span className="font-mono font-bold text-emerald-950 bg-white px-2 py-1 rounded-lg border border-emerald-200 inline-block mt-0.5">
                        {activeDetailRecord.destinationAccountNumber || '-'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Latest Audit Preview */}
              {activeDetailRecord.auditLogs && activeDetailRecord.auditLogs.length > 0 && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-[11px] text-slate-600">
                    <span className="font-bold text-slate-900">Aktivitas Audit Terakhir:</span>{' '}
                    {activeDetailRecord.auditLogs[activeDetailRecord.auditLogs.length - 1].action} oleh{' '}
                    <strong>{activeDetailRecord.auditLogs[activeDetailRecord.auditLogs.length - 1].user}</strong>{' '}
                    ({activeDetailRecord.auditLogs[activeDetailRecord.auditLogs.length - 1].timestamp})
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const rec = activeDetailRecord;
                      setDetailRecord(null);
                      setAuditRecord(rec);
                    }}
                    className="text-[11px] font-extrabold text-amber-700 hover:text-amber-900 underline cursor-pointer"
                  >
                    Lihat Semua Audit ({activeDetailRecord.auditLogs.length})
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const rec = activeDetailRecord;
                    setDetailRecord(null);
                    setAuditRecord(rec);
                  }}
                  className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Audit History</span>
                </button>
                {!activeDetailRecord.isDeleted && (
                  <button
                    type="button"
                    onClick={() => {
                      const rec = activeDetailRecord;
                      setDetailRecord(null);
                      handleOpenEdit(rec);
                    }}
                    className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Transaksi</span>
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setDetailRecord(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
